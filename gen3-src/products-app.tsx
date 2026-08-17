import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

type CatalogProduct = {
  id: string;
  rank: number | null;
  category: string;
  imageUrl: string;
  cleanName: string;
  summary: string;
  priceMin: number | null;
  priceMax: number | null;
  checkedAt: string;
  productUrl: string;
  featured: boolean;
  shopName?: string;
};

type CatalogResponse = {
  generatedAt: string;
  total: number;
  featured: CatalogProduct[];
  ranked: CatalogProduct[];
};

type PriceFilter = "all" | "under-100" | "100-300" | "301-500" | "501-1000" | "over-1000";
type SortMode = "rank" | "price-asc" | "price-desc";

const PAGE_SIZE = 24;
const PRICE_FILTERS: Array<{ value: PriceFilter; label: string; min?: number; max?: number }> = [
  { value: "all", label: "ทุกช่วงราคา" },
  { value: "under-100", label: "ต่ำกว่า ฿100", max: 99.99 },
  { value: "100-300", label: "฿100–฿300", min: 100, max: 300 },
  { value: "301-500", label: "฿301–฿500", min: 301, max: 500 },
  { value: "501-1000", label: "฿501–฿1,000", min: 501, max: 1000 },
  { value: "over-1000", label: "มากกว่า ฿1,000", min: 1000.01 },
];

const numberFormatter = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "2-digit",
  timeZone: "Asia/Bangkok",
});
const timeFormatter = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Bangkok",
});

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("th-TH").replace(/\s+/g, " ").trim();
}

function formatPrice(product: CatalogProduct) {
  const min = product.priceMin;
  const max = product.priceMax;
  if (min === null && max === null) return "ยังไม่พบราคา";
  const first = min ?? max ?? 0;
  const last = max ?? min ?? first;
  if (Math.abs(first - last) < 0.001) return `฿${numberFormatter.format(first)}`;
  return `฿${numberFormatter.format(Math.min(first, last))}–฿${numberFormatter.format(Math.max(first, last))}`;
}

function formatCheckedAt(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "ยังไม่พบเวลาตรวจ";
  return `ตรวจข้อมูล ${dateFormatter.format(date)} เวลา ${timeFormatter.format(date)}`;
}

function formatCatalogUpdatedAt(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "กำลังโหลดเวลาอัปเดต";
  return `อัปเดตคลัง ${dateFormatter.format(date)} เวลา ${timeFormatter.format(date)}`;
}

function productPriceRange(product: CatalogProduct) {
  const first = product.priceMin ?? product.priceMax;
  const last = product.priceMax ?? product.priceMin;
  if (first === null || first === undefined || last === null || last === undefined) return null;
  return { min: Math.min(first, last), max: Math.max(first, last) };
}

function matchesPrice(product: CatalogProduct, filter: PriceFilter) {
  if (filter === "all") return true;
  const productRange = productPriceRange(product);
  if (!productRange) return false;
  const selected = PRICE_FILTERS.find((option) => option.value === filter);
  if (!selected) return true;
  const min = selected.min ?? Number.NEGATIVE_INFINITY;
  const max = selected.max ?? Number.POSITIVE_INFINITY;
  return productRange.max >= min && productRange.min <= max;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back when the API exists but permission is unavailable.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (copied) return;
  throw new Error("copy failed");
}

function ProductImage({ product, eager = false, onError }: { product: CatalogProduct; eager?: boolean; onError: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className="catalog-image-placeholder" role="img" aria-label={`ไม่สามารถแสดงรูป ${product.cleanName}`}>ไม่มีรูปตัวอย่าง</div>;
  }
  return (
    <img
      alt={product.cleanName}
      decoding="async"
      fetchPriority={eager ? "high" : "auto"}
      loading={eager ? "eager" : "lazy"}
      onError={() => { setFailed(true); onError(); }}
      referrerPolicy="no-referrer"
      src={product.imageUrl}
    />
  );
}

type CardProps = {
  product: CatalogProduct;
  featured?: boolean;
  copiedKey: string;
  onCopy: (key: string, value: string, label: string) => void;
  onPreview: (product: CatalogProduct) => void;
};

function ProductActions({ product, imageFailed, copiedKey, onCopy, onPreview }: CardProps & { imageFailed: boolean }) {
  const nameKey = `${product.id}:name`;
  const summaryKey = `${product.id}:summary`;
  const downloadHref = `/api/gen3-product-image?id=${encodeURIComponent(product.id)}`;
  return (
    <div className="catalog-card__actions">
      <button className="catalog-action" disabled={imageFailed} type="button" onClick={() => onPreview(product)}>{imageFailed ? "ดูรูปไม่ได้" : "ดูรูปใหญ่"}</button>
      {imageFailed ? (
        <span className="catalog-action catalog-action--disabled" aria-disabled="true">ดาวน์โหลดไม่ได้</span>
      ) : (
        <a className="catalog-action" href={downloadHref}>ดาวน์โหลดรูป</a>
      )}
      <button className="catalog-action" type="button" onClick={() => onCopy(nameKey, product.cleanName, "ชื่อสินค้า")}>
        {copiedKey === nameKey ? "คัดลอกแล้ว ✓" : "คัดลอกชื่อ"}
      </button>
      <button
        className="catalog-action"
        disabled={!product.summary}
        type="button"
        onClick={() => onCopy(summaryKey, product.summary, "รายละเอียดสินค้า")}
      >
        {copiedKey === summaryKey ? "คัดลอกแล้ว ✓" : "คัดลอกรายละเอียด"}
      </button>
      <a className="catalog-action catalog-action--shopee" href={product.productUrl} rel="noopener noreferrer" target="_blank">เปิด Shopee ↗</a>
    </div>
  );
}

function ProductCard(props: CardProps) {
  const { product, featured = false } = props;
  const [imageFailed, setImageFailed] = useState(false);
  const headingId = `catalog-product-${product.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <article aria-labelledby={headingId} className={featured ? "catalog-card catalog-card--featured" : "catalog-card"}>
      <div className="catalog-card__media">
        <ProductImage eager={featured} onError={() => setImageFailed(true)} product={product} />
        {featured && <span className="catalog-card__recommended">สินค้าแนะนำจาก BusinessBoy</span>}
      </div>
      <div className="catalog-card__body">
        <div className="catalog-card__meta">
          <span>{product.category}</span>
          {featured ? <b>แนะนำ</b> : <b>{product.rank === null ? "ไม่จัดอันดับ" : `#${String(product.rank).padStart(3, "0")}`}</b>}
        </div>
        <h3 id={headingId}>{product.cleanName}</h3>
        {featured && product.shopName && <p className="catalog-card__shop">ร้าน {product.shopName}</p>}
        <p className="catalog-card__summary">{product.summary || "ยังไม่มีรายละเอียดสรุป"}</p>
        <div className="catalog-card__price">
          <strong>{formatPrice(product)}</strong>
          <small>{formatCheckedAt(product.checkedAt)}</small>
        </div>
        <ProductActions {...props} imageFailed={imageFailed} />
      </div>
    </article>
  );
}

type FilterFieldsProps = {
  idPrefix: string;
  categories: string[];
  category: string;
  priceFilter: PriceFilter;
  sortMode: SortMode;
  onCategory: (value: string) => void;
  onPrice: (value: PriceFilter) => void;
  onSort: (value: SortMode) => void;
  onClear: () => void;
};

function FilterFields(props: FilterFieldsProps) {
  return (
    <div className="catalog-filter-fields">
      <label htmlFor={`${props.idPrefix}-category`}><span>หมวดสินค้า</span>
        <select id={`${props.idPrefix}-category`} value={props.category} onChange={(event) => props.onCategory(event.target.value)}>
          <option value="all">ทุกหมวดสินค้า</option>
          {props.categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label htmlFor={`${props.idPrefix}-price`}><span>ช่วงราคา</span>
        <select id={`${props.idPrefix}-price`} value={props.priceFilter} onChange={(event) => props.onPrice(event.target.value as PriceFilter)}>
          {PRICE_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label htmlFor={`${props.idPrefix}-sort`}><span>เรียงลำดับ</span>
        <select id={`${props.idPrefix}-sort`} value={props.sortMode} onChange={(event) => props.onSort(event.target.value as SortMode)}>
          <option value="rank">อันดับแนะนำ</option>
          <option value="price-asc">ราคาต่ำไปสูง</option>
          <option value="price-desc">ราคาสูงไปต่ำ</option>
        </select>
      </label>
      <button className="catalog-clear-button" type="button" onClick={props.onClear}>ล้างตัวกรอง</button>
    </div>
  );
}

function LoadingGrid() {
  return <div className="catalog-grid" aria-label="กำลังโหลดสินค้า">{Array.from({ length: 8 }, (_, index) => <div className="catalog-skeleton" key={index}><span /><i /><i /><i /></div>)}</div>;
}

function CatalogApp() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("rank");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [copiedKey, setCopiedKey] = useState("");
  const [toast, setToast] = useState("");
  const [preview, setPreview] = useState<CatalogProduct | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const filterDialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const filterButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    fetch("/api/gen3-products", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.reload();
          throw new Error("unauthorized");
        }
        if (!response.ok) throw new Error("โหลดรายการสินค้าไม่สำเร็จ");
        return response.json();
      })
      .then((result: CatalogResponse) => setCatalog(result))
      .catch((error) => {
        if (error.name !== "AbortError" && error.message !== "unauthorized") setLoadError("เปิดคลังสินค้าไม่สำเร็จ กรุณาลองอีกครั้ง");
      });
    return () => controller.abort();
  }, [retryCount]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [query, category, priceFilter, sortMode]);

  useEffect(() => {
    const dialog = previewDialog.current;
    if (!dialog) return;
    if (preview && !dialog.open) dialog.showModal();
    if (!preview && dialog.open) dialog.close();
  }, [preview]);

  useEffect(() => {
    const dialog = filterDialog.current;
    if (!dialog) return;
    if (filterOpen && !dialog.open) dialog.showModal();
    if (!filterOpen && dialog.open) dialog.close();
  }, [filterOpen]);

  const categories = useMemo(() => {
    if (!catalog) return [];
    return Array.from(new Set(catalog.ranked.map((product) => product.category).filter(Boolean))).sort((left, right) => left.localeCompare(right, "th"));
  }, [catalog]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const search = normalize(query);
    const result = catalog.ranked.filter((product) => {
      const matchesQuery = !search || normalize(`${product.cleanName} ${product.summary} ${product.category}`).includes(search);
      return matchesQuery && (category === "all" || product.category === category) && matchesPrice(product, priceFilter);
    });
    return result.sort((left, right) => {
      if (sortMode === "price-asc") return (left.priceMin ?? left.priceMax ?? Number.POSITIVE_INFINITY) - (right.priceMin ?? right.priceMax ?? Number.POSITIVE_INFINITY);
      if (sortMode === "price-desc") return (right.priceMax ?? right.priceMin ?? Number.NEGATIVE_INFINITY) - (left.priceMax ?? left.priceMin ?? Number.NEGATIVE_INFINITY);
      return (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER);
    });
  }, [catalog, query, category, priceFilter, sortMode]);

  const visibleProducts = filtered.slice(0, visibleCount);

  function clearFilters() {
    setCategory("all");
    setPriceFilter("all");
    setSortMode("rank");
  }

  async function handleCopy(key: string, value: string, label: string) {
    try {
      await copyText(value);
      setCopiedKey(key);
      setToast(`คัดลอก${label}แล้ว`);
      window.setTimeout(() => setCopiedKey((current) => current === key ? "" : current), 1800);
      window.setTimeout(() => setToast(""), 1800);
    } catch {
      setToast("คัดลอกไม่สำเร็จ กรุณาลองอีกครั้ง");
      window.setTimeout(() => setToast(""), 2400);
    }
  }

  function openPreview(product: CatalogProduct) {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPreviewFailed(false);
    setPreview(product);
  }

  function closePreview() {
    if (previewDialog.current?.open) previewDialog.current.close();
    else setPreview(null);
  }

  function closeFilters() {
    if (filterDialog.current?.open) filterDialog.current.close();
    else setFilterOpen(false);
  }

  const cardProps = { copiedKey, onCopy: handleCopy, onPreview: openPreview };
  const filterProps = { categories, category, priceFilter, sortMode, onCategory: setCategory, onPrice: setPriceFilter, onSort: setSortMode, onClear: clearFilters };

  async function logout() {
    await fetch("/api/gen3-auth", { method: "DELETE" }).catch(() => undefined);
    window.location.reload();
  }

  return (
    <main className="app-page catalog-app">
      <header className="app-header">
        <a className="brand-link" href="/gen3">
          <img alt="เด็กประกอบการ" height="64" src="/businessboy-logo.jpg" width="64" />
          <div><b>คลังสินค้า Top 500</b><span>สำหรับนักเรียนรุ่น 3</span></div>
        </a>
        <div className="header-message"><span>คัดมาเพื่อทำคลิปแนวโกดัง</span><small>ค้นหา → ดาวน์โหลดรูป → เปิด Shopee</small></div>
        <button className="logout-button" onClick={logout} type="button">ออกจากระบบ</button>
      </header>

      <div className="catalog-shell">
        <section className="catalog-intro" aria-labelledby="catalog-title">
          <div><span className="eyebrow">PRODUCT LIBRARY · รุ่น 3</span><h1 id="catalog-title">500 สินค้าสำหรับทำคลิปแนวโกดัง</h1><p>ค้นหารูป ชื่อ รายละเอียดย่อ และราคาของสินค้าที่คัดมาให้แล้ว</p></div>
          <div className="catalog-intro__stats" aria-label="ข้อมูลคลังสินค้า">
            <span><b>{catalog?.total ?? 500}</b> รายการ</span>
            <span>{catalog?.generatedAt ? formatCatalogUpdatedAt(catalog.generatedAt) : "กำลังโหลดเวลาอัปเดต"}</span>
          </div>
        </section>

        <section className="catalog-search" aria-label="ค้นหาสินค้า">
          <label htmlFor="catalog-query"><span>ค้นหาสินค้า</span>
            <input id="catalog-query" type="search" placeholder="เช่น กล่องจัดระเบียบ, ของใช้ในครัว" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <button ref={filterButton} className="catalog-filter-mobile" type="button" onClick={() => setFilterOpen(true)} aria-controls="catalog-filter-dialog" aria-expanded={filterOpen} aria-haspopup="dialog">ตัวกรอง</button>
        </section>

        {catalog?.featured?.length ? (
          <section className="catalog-featured" aria-labelledby="featured-title">
            <div className="catalog-section-heading"><div><span>BUSINESSBOY RECOMMENDS</span><h2 id="featured-title">สินค้าแนะนำ</h2></div><small>วางไว้เหนืออันดับทั้งหมด · ไม่นับรวมใน Top 500</small></div>
            {catalog.featured.map((product) => <ProductCard {...cardProps} featured key={product.id} product={product} />)}
          </section>
        ) : null}

        <section className="catalog-toolbar" aria-label="ตัวกรองและการเรียงสินค้า">
          <FilterFields idPrefix="desktop" {...filterProps} />
        </section>

        <section className="catalog-results" aria-labelledby="results-title">
          <div className="catalog-section-heading catalog-section-heading--results">
            <div><span>TOP 500</span><h2 id="results-title">รายการสินค้า</h2></div>
            <small aria-live="polite">พบ {numberFormatter.format(filtered.length)} รายการ{query ? ` จากคำค้น “${query}”` : ""}</small>
          </div>

          {!catalog && !loadError && <LoadingGrid />}
          {loadError && <div className="catalog-state" role="alert"><h3>เปิดคลังสินค้าไม่สำเร็จ</h3><p>ตรวจการเชื่อมต่อแล้วลองโหลดรายการอีกครั้ง</p><button type="button" onClick={() => setRetryCount((value) => value + 1)}>ลองอีกครั้ง</button></div>}
          {catalog && filtered.length === 0 && <div className="catalog-state"><h3>ยังไม่พบสินค้าที่ตรงกัน</h3><p>ลองใช้คำค้นสั้นลงหรือเปลี่ยนตัวกรอง</p><button type="button" onClick={() => { setQuery(""); clearFilters(); }}>ล้างการค้นหาและตัวกรอง</button></div>}
          {catalog && visibleProducts.length > 0 && <div className="catalog-grid">{visibleProducts.map((product) => <ProductCard {...cardProps} key={product.id} product={product} />)}</div>}
          {visibleCount < filtered.length && <div className="catalog-load-more"><p>แสดง {numberFormatter.format(visibleProducts.length)} จาก {numberFormatter.format(filtered.length)} รายการ</p><button type="button" onClick={() => setVisibleCount((value) => value + PAGE_SIZE)}>โหลดเพิ่มอีก {Math.min(PAGE_SIZE, filtered.length - visibleCount)} รายการ</button></div>}
        </section>
      </div>

      <dialog aria-labelledby="catalog-preview-title" className="catalog-preview" ref={previewDialog} onClose={() => { setPreview(null); previousFocus.current?.focus(); }} onClick={(event) => { if (event.target === event.currentTarget) closePreview(); }}>
        {preview && <div className="catalog-preview__panel">
          <div className="catalog-preview__heading"><div><span>{preview.category}</span><h2 id="catalog-preview-title">{preview.cleanName}</h2></div><button type="button" onClick={closePreview} aria-label="ปิดรูปตัวอย่าง">×</button></div>
          <div className="catalog-preview__image">{previewFailed ? <div className="catalog-image-placeholder" role="img" aria-label={`ไม่สามารถแสดงรูป ${preview.cleanName}`}>ไม่สามารถแสดงรูปตัวอย่างได้</div> : <img alt={preview.cleanName} src={preview.imageUrl} referrerPolicy="no-referrer" onError={() => setPreviewFailed(true)} />}</div>
          <div className="catalog-preview__actions">{previewFailed ? <span aria-disabled="true">ดาวน์โหลดไม่ได้</span> : <a href={`/api/gen3-product-image?id=${encodeURIComponent(preview.id)}`}>ดาวน์โหลดรูป</a>}<a href={preview.productUrl} target="_blank" rel="noopener noreferrer">เปิด Shopee ↗</a></div>
        </div>}
      </dialog>

      <dialog aria-labelledby="catalog-filter-title" className="catalog-filter-dialog" id="catalog-filter-dialog" ref={filterDialog} onClose={() => { setFilterOpen(false); filterButton.current?.focus(); }}>
        <div className="catalog-filter-dialog__heading"><div><span>ปรับผลลัพธ์</span><h2 id="catalog-filter-title">ตัวกรองสินค้า</h2></div><button type="button" onClick={closeFilters} aria-label="ปิดตัวกรอง">×</button></div>
        <FilterFields idPrefix="mobile" {...filterProps} />
        <button className="catalog-filter-apply" type="button" onClick={closeFilters}>ดู {numberFormatter.format(filtered.length)} รายการ</button>
      </dialog>

      <div className={toast ? "catalog-toast catalog-toast--show" : "catalog-toast"} role="status" aria-live="polite">{toast}</div>
    </main>
  );
}

const root = document.getElementById("catalog-root");
if (!root) throw new Error("Missing #catalog-root");
createRoot(root).render(<CatalogApp />);
