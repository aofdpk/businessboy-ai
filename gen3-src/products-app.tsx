import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

type CatalogProduct = {
  id: string;
  rank: number | null;
  category: string;
  categoryKey: string;
  imageUrl: string;
  cleanName: string;
  summary: string;
  priceMin: number | null;
  priceMax: number | null;
  checkedAt: string;
  productUrl: string;
  featured: boolean;
  shopName?: string;
  seasonTags: string[];
  monthTags: number[];
  seasonalScore: number;
  seasonReason: string;
};

type CategoryFacet = { key: string; label: string; count: number };
type SeasonFacet = { key: string; label: string; count: number };
type MonthFacet = { month: number; count: number };

type CatalogResponse = {
  schemaVersion: number;
  generatedAt: string;
  total: number;
  matched: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
  featured: CatalogProduct[];
  items: CatalogProduct[];
  facets: {
    categories: CategoryFacet[];
    seasons: SeasonFacet[];
    months: MonthFacet[];
  };
};

type PriceFilter = "all" | "under-100" | "100-300" | "301-500" | "501-1000" | "over-1000";
type SortMode = "rank" | "price-asc" | "price-desc";
type PeriodFilter = "all" | "current-month" | "all-year" | "hot" | "rainy" | "cool" | `month-${number}`;

const PAGE_SIZE = 24;
const PRICE_FILTERS: Array<{ value: PriceFilter; label: string }> = [
  { value: "all", label: "ทุกช่วงราคา" },
  { value: "under-100", label: "ต่ำกว่า ฿100" },
  { value: "100-300", label: "฿100–฿300" },
  { value: "301-500", label: "฿301–฿500" },
  { value: "501-1000", label: "฿501–฿1,000" },
  { value: "over-1000", label: "มากกว่า ฿1,000" },
];
const MONTH_LABELS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const PERIOD_LABELS: Record<string, string> = {
  all: "ทุกช่วงเวลา",
  "all-year": "ขายได้ตลอดปี",
  hot: "หน้าร้อน (มี.ค.–พ.ค.)",
  rainy: "หน้าฝน (มิ.ย.–ต.ค.)",
  cool: "หน้าหนาว/อากาศเย็น (พ.ย.–ก.พ.)",
};
const SORT_LABELS: Record<SortMode, string> = {
  rank: "อันดับแนะนำ",
  "price-asc": "ราคาต่ำไปสูง",
  "price-desc": "ราคาสูงไปต่ำ",
};

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

function currentBangkokMonth() {
  const value = new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: "Asia/Bangkok" }).format(new Date());
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : 1;
}

const CURRENT_BANGKOK_MONTH = currentBangkokMonth();

function apiPeriod(period: PeriodFilter) {
  return period === "current-month" ? `month-${CURRENT_BANGKOK_MONTH}` : period;
}

function periodLabel(period: PeriodFilter) {
  if (period === "current-month") return `เดือนนี้ (${MONTH_LABELS[CURRENT_BANGKOK_MONTH - 1]})`;
  if (period.startsWith("month-")) {
    const month = Number(period.slice("month-".length));
    return MONTH_LABELS[month - 1] || "เดือนที่เลือก";
  }
  return PERIOD_LABELS[period] || "ช่วงเวลาที่เลือก";
}

function buildCatalogUrl(filters: { query: string; category: string; period: PeriodFilter; price: PriceFilter; sort: SortMode; offset: number }) {
  const params = new URLSearchParams({
    q: filters.query,
    category: filters.category,
    period: apiPeriod(filters.period),
    price: filters.price,
    sort: filters.sort,
    offset: String(filters.offset),
    limit: String(PAGE_SIZE),
  });
  return `/api/gen3-products?${params.toString()}`;
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

function hasAvailablePrice(product: CatalogProduct) {
  return product.priceMin !== null || product.priceMax !== null;
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
  const summaryPriceKey = `${product.id}:summary-price`;
  const canCopySummaryPrice = Boolean(product.summary) && hasAvailablePrice(product);
  const summaryPrice = `รายละเอียดสินค้า: ${product.summary}\nราคาปัจจุบัน: ${formatPrice(product)}`;
  const downloadHref = `/api/gen3-product-image?id=${encodeURIComponent(product.id)}`;
  return (
    <div className="catalog-card__actions">
      <button aria-label={`${imageFailed ? "ดูรูปไม่ได้" : "ดูรูปใหญ่"}: ${product.cleanName}`} className="catalog-action" disabled={imageFailed} type="button" onClick={() => onPreview(product)}>{imageFailed ? "ดูรูปไม่ได้" : "ดูรูปใหญ่"}</button>
      {imageFailed ? (
        <span className="catalog-action catalog-action--disabled" aria-disabled="true">ดาวน์โหลดไม่ได้</span>
      ) : (
        <a aria-label={`ดาวน์โหลดรูป ${product.cleanName}`} className="catalog-action" href={downloadHref}>ดาวน์โหลดรูป</a>
      )}
      <button aria-label={`${copiedKey === nameKey ? "คัดลอกชื่อแล้ว" : "คัดลอกชื่อ"}: ${product.cleanName}`} className="catalog-action" type="button" onClick={() => onCopy(nameKey, product.cleanName, "ชื่อสินค้า")}>
        {copiedKey === nameKey ? "คัดลอกแล้ว ✓" : "คัดลอกชื่อ"}
      </button>
      <button
        aria-label={`${copiedKey === summaryKey ? "คัดลอกรายละเอียดแล้ว" : "คัดลอกรายละเอียด"}: ${product.cleanName}`}
        className="catalog-action"
        disabled={!product.summary}
        type="button"
        onClick={() => onCopy(summaryKey, product.summary, "รายละเอียดสินค้า")}
      >
        {copiedKey === summaryKey ? "คัดลอกแล้ว ✓" : "คัดลอกรายละเอียด"}
      </button>
      <button
        aria-label={`${copiedKey === summaryPriceKey ? "คัดลอกรายละเอียดพร้อมราคาแล้ว" : "คัดลอกรายละเอียดพร้อมราคา"}: ${product.cleanName}`}
        className="catalog-action catalog-action--summary-price"
        disabled={!canCopySummaryPrice}
        type="button"
        onClick={() => onCopy(summaryPriceKey, summaryPrice, "รายละเอียดพร้อมราคา")}
      >
        {copiedKey === summaryPriceKey ? "คัดลอกแล้ว ✓" : "คัดลอกรายละเอียดพร้อมราคา"}
      </button>
      <a aria-label={`เปิด ${product.cleanName} ใน Shopee`} className="catalog-action catalog-action--shopee" href={product.productUrl} rel="noopener noreferrer" target="_blank">เปิด Shopee ↗</a>
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
          {featured ? <b>แนะนำ</b> : <b>{product.rank === null ? "ไม่จัดอันดับ" : `#${String(product.rank).padStart(4, "0")}`}</b>}
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
  categories: CategoryFacet[];
  seasonFacets: SeasonFacet[];
  monthFacets: MonthFacet[];
  category: string;
  period: PeriodFilter;
  priceFilter: PriceFilter;
  sortMode: SortMode;
  activeCount: number;
  onCategory: (value: string) => void;
  onPeriod: (value: PeriodFilter) => void;
  onPrice: (value: PriceFilter) => void;
  onSort: (value: SortMode) => void;
  onClear: () => void;
};

function FilterFields(props: FilterFieldsProps) {
  const currentMonth = CURRENT_BANGKOK_MONTH;
  const currentMonthCount = props.monthFacets.find((item) => item.month === currentMonth)?.count ?? 0;
  function seasonCount(key: string) {
    return props.seasonFacets.find((item) => item.key === key)?.count ?? 0;
  }
  function monthCount(month: number) {
    return props.monthFacets.find((item) => item.month === month)?.count ?? 0;
  }
  return (
    <div className="catalog-filter-fields">
      <label htmlFor={`${props.idPrefix}-category`}><span>หมวดสินค้า</span>
        <select id={`${props.idPrefix}-category`} value={props.category} onChange={(event) => props.onCategory(event.target.value)}>
          <option value="all">ทุกหมวดสินค้า</option>
          {props.categories.map((item) => <option key={item.key} value={item.key}>{item.label} ({numberFormatter.format(item.count)})</option>)}
        </select>
      </label>
      <label htmlFor={`${props.idPrefix}-period`}><span>ช่วงเวลาที่เหมาะทำคอนเทนต์</span>
        <select id={`${props.idPrefix}-period`} value={props.period} onChange={(event) => props.onPeriod(event.target.value as PeriodFilter)}>
          <option value="all">ทุกช่วงเวลา</option>
          <option value="all-year">ขายได้ตลอดปี ({numberFormatter.format(seasonCount("all-year"))})</option>
          <option value="hot">หน้าร้อน · มี.ค.–พ.ค. ({numberFormatter.format(seasonCount("hot"))})</option>
          <option value="rainy">หน้าฝน · มิ.ย.–ต.ค. ({numberFormatter.format(seasonCount("rainy"))})</option>
          <option value="cool">หน้าหนาว/อากาศเย็น · พ.ย.–ก.พ. ({numberFormatter.format(seasonCount("cool"))})</option>
          <option value="current-month">เดือนนี้ · {MONTH_LABELS[currentMonth - 1]} ({numberFormatter.format(currentMonthCount)})</option>
          {MONTH_LABELS.map((label, index) => <option key={label} value={`month-${index + 1}`}>{index + 1}. {label} ({numberFormatter.format(monthCount(index + 1))})</option>)}
        </select>
      </label>
      <label htmlFor={`${props.idPrefix}-price`}><span>ช่วงราคา</span>
        <select id={`${props.idPrefix}-price`} value={props.priceFilter} onChange={(event) => props.onPrice(event.target.value as PriceFilter)}>
          {PRICE_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label htmlFor={`${props.idPrefix}-sort`}><span>เรียงลำดับ</span>
        <select id={`${props.idPrefix}-sort`} value={props.sortMode} onChange={(event) => props.onSort(event.target.value as SortMode)}>
          <option value="rank">{props.period === "all" ? "อันดับแนะนำ" : "เหมาะกับช่วงนี้"}</option>
          <option value="price-asc">ราคาต่ำไปสูง</option>
          <option value="price-desc">ราคาสูงไปต่ำ</option>
        </select>
      </label>
      <button className="catalog-clear-button" disabled={props.activeCount === 0} type="button" onClick={props.onClear}>ล้างตัวกรอง</button>
    </div>
  );
}

function LoadingGrid() {
  return <div className="catalog-grid" aria-label="กำลังโหลดสินค้า">{Array.from({ length: 8 }, (_, index) => <div className="catalog-skeleton" key={index}><span /><i /><i /><i /></div>)}</div>;
}

function CatalogApp() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [featured, setFeatured] = useState<CatalogProduct[]>([]);
  const [loadError, setLoadError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("rank");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");
  const [toast, setToast] = useState("");
  const [preview, setPreview] = useState<CatalogProduct | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const filterDialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 320);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const sequence = ++requestSequence.current;
    setLoadError("");
    setIsLoading(true);
    setIsLoadingMore(false);
    setProducts([]);

    const url = buildCatalogUrl({ query: debouncedQuery, category, period, price: priceFilter, sort: sortMode, offset: 0 });
    fetch(url, { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.reload();
          throw new Error("unauthorized");
        }
        if (!response.ok) throw new Error("โหลดรายการสินค้าไม่สำเร็จ");
        return response.json();
      })
      .then((result: CatalogResponse) => {
        if (sequence !== requestSequence.current) return;
        setCatalog(result);
        setProducts(Array.isArray(result.items) ? result.items : []);
        setFeatured(Array.isArray(result.featured) ? result.featured : []);
      })
      .catch((error) => {
        if (error.name !== "AbortError" && error.message !== "unauthorized" && sequence === requestSequence.current) {
          setLoadError("เปิดคลังสินค้าไม่สำเร็จ กรุณาลองอีกครั้ง");
        }
      })
      .finally(() => {
        if (sequence === requestSequence.current) setIsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, category, period, priceFilter, sortMode, retryCount]);

  useEffect(() => () => activeRequest.current?.abort(), []);

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

  const categories = catalog?.facets?.categories ?? [];
  const seasonFacets = catalog?.facets?.seasons ?? [];
  const monthFacets = catalog?.facets?.months ?? [];
  const activeCount = Number(category !== "all") + Number(period !== "all") + Number(priceFilter !== "all") + Number(sortMode !== "rank");

  function clearFilters() {
    setCategory("all");
    setPeriod("all");
    setPriceFilter("all");
    setSortMode("rank");
  }

  function clearEverything() {
    setQuery("");
    setDebouncedQuery("");
    clearFilters();
  }

  async function loadMore() {
    if (!catalog || catalog.nextOffset === null || isLoadingMore) return;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const sequence = ++requestSequence.current;
    setIsLoadingMore(true);
    setLoadError("");
    try {
      const url = buildCatalogUrl({ query: debouncedQuery, category, period, price: priceFilter, sort: sortMode, offset: catalog.nextOffset });
      const response = await fetch(url, { credentials: "same-origin", signal: controller.signal });
      if (response.status === 401) {
        window.location.reload();
        throw new Error("unauthorized");
      }
      if (!response.ok) throw new Error("โหลดรายการสินค้าไม่สำเร็จ");
      const result = await response.json() as CatalogResponse;
      if (sequence !== requestSequence.current) return;
      setProducts((current) => {
        const seen = new Set(current.map((product) => product.id));
        return [...current, ...result.items.filter((product) => !seen.has(product.id))];
      });
      setCatalog((current) => current ? { ...current, matched: result.matched, nextOffset: result.nextOffset } : result);
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError" && error.message !== "unauthorized" && sequence === requestSequence.current) {
        setToast("โหลดสินค้าเพิ่มไม่สำเร็จ กรุณาลองอีกครั้ง");
        window.setTimeout(() => setToast(""), 2400);
      }
    } finally {
      if (sequence === requestSequence.current) setIsLoadingMore(false);
    }
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
  const filterProps = {
    categories,
    seasonFacets,
    monthFacets,
    category,
    period,
    priceFilter,
    sortMode,
    activeCount,
    onCategory: setCategory,
    onPeriod: setPeriod,
    onPrice: setPriceFilter,
    onSort: setSortMode,
    onClear: clearFilters,
  };

  const activeCategory = categories.find((item) => item.key === category)?.label || "หมวดที่เลือก";
  const activePrice = PRICE_FILTERS.find((item) => item.value === priceFilter)?.label || "ช่วงราคาที่เลือก";

  async function logout() {
    await fetch("/api/gen3-auth", { method: "DELETE" }).catch(() => undefined);
    window.location.reload();
  }

  return (
    <main className="app-page catalog-app">
      <header className="app-header">
        <a className="brand-link" href="/gen3">
          <img alt="เด็กประกอบการ" height="64" src="/businessboy-logo.jpg" width="64" />
          <div><b>คลังสินค้าแนะนำ</b><span>สำหรับนักเรียนรุ่น 3</span></div>
        </a>
        <div className="header-message"><span>คัดมาเพื่อทำคลิปแนวโกดัง</span><small>ค้นหา → ดาวน์โหลดรูป → เปิด Shopee</small></div>
        <button className="logout-button" onClick={logout} type="button">ออกจากระบบ</button>
      </header>

      <div className="catalog-shell">
        <section className="catalog-intro" aria-labelledby="catalog-title">
          <div><span className="eyebrow">PRODUCT LIBRARY · รุ่น 3</span><h1 id="catalog-title">{catalog ? `รวม ${numberFormatter.format(catalog.total)} สินค้าสำหรับทำคลิปแนวโกดัง` : "คลังสินค้าสำหรับทำคลิปแนวโกดัง"}</h1><p>ค้นหารูป ชื่อ รายละเอียดย่อ ราคา และสินค้าที่เหมาะนำเสนอในแต่ละช่วงเวลา</p></div>
          <div className="catalog-intro__stats" role="group" aria-label="ข้อมูลคลังสินค้า">
            <span><b>{catalog ? numberFormatter.format(catalog.total) : "—"}</b> รายการ</span>
            <span>{catalog?.generatedAt ? formatCatalogUpdatedAt(catalog.generatedAt) : "กำลังโหลดเวลาอัปเดต"}</span>
          </div>
        </section>

        <section className="catalog-search" aria-label="ค้นหาสินค้า">
          <label htmlFor="catalog-query"><span>ค้นหาสินค้า</span>
            <input id="catalog-query" type="search" placeholder="เช่น อุปกรณ์รถ, เครื่องมือช่าง, หนังสือ" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <button ref={filterButton} className="catalog-filter-mobile" type="button" onClick={() => setFilterOpen(true)} aria-expanded={filterOpen} aria-haspopup="dialog">ตัวกรอง{activeCount ? ` (${activeCount})` : ""}</button>
        </section>

        {featured.length ? (
          <section className="catalog-featured" aria-labelledby="featured-title">
            <div className="catalog-section-heading"><div><span>BUSINESSBOY RECOMMENDS</span><h2 id="featured-title">สินค้าแนะนำ</h2></div></div>
            {featured.map((product) => <ProductCard {...cardProps} featured key={product.id} product={product} />)}
          </section>
        ) : null}

        <section className="catalog-toolbar" aria-label="ตัวกรองและการเรียงสินค้า">
          <FilterFields idPrefix="desktop" {...filterProps} />
        </section>

        {activeCount > 0 && <div className="catalog-active-filters" aria-label="ตัวกรองที่กำลังใช้">
          <span>กำลังกรอง:</span>
          {category !== "all" && <button type="button" onClick={() => setCategory("all")} aria-label={`ยกเลิกหมวด ${activeCategory}`}>{activeCategory} ×</button>}
          {period !== "all" && <button type="button" onClick={() => setPeriod("all")} aria-label={`ยกเลิกช่วงเวลา ${periodLabel(period)}`}>{periodLabel(period)} ×</button>}
          {priceFilter !== "all" && <button type="button" onClick={() => setPriceFilter("all")} aria-label={`ยกเลิกช่วงราคา ${activePrice}`}>{activePrice} ×</button>}
          {sortMode !== "rank" && <button type="button" onClick={() => setSortMode("rank")} aria-label={`ยกเลิกการเรียง ${SORT_LABELS[sortMode]}`}>{SORT_LABELS[sortMode]} ×</button>}
          <button className="catalog-active-filters__clear" type="button" onClick={clearFilters}>ล้างทั้งหมด</button>
        </div>}

        <section className="catalog-results" aria-labelledby="results-title" aria-busy={isLoading}>
          <div className="catalog-section-heading catalog-section-heading--results">
            <div><span>PRODUCT CATALOG</span><h2 id="results-title">รายการสินค้า</h2></div>
            <small aria-live="polite">{isLoading ? "กำลังค้นหา…" : `พบ ${numberFormatter.format(catalog?.matched ?? 0)} รายการ${debouncedQuery ? ` จากคำค้น “${debouncedQuery}”` : ""}`}</small>
          </div>

          {isLoading && <LoadingGrid />}
          {!isLoading && loadError && <div className="catalog-state" role="alert"><h3>เปิดคลังสินค้าไม่สำเร็จ</h3><p>ตรวจการเชื่อมต่อแล้วลองโหลดรายการอีกครั้ง</p><button type="button" onClick={() => setRetryCount((value) => value + 1)}>ลองอีกครั้ง</button></div>}
          {!isLoading && !loadError && catalog && catalog.matched === 0 && <div className="catalog-state"><h3>ไม่พบสินค้าที่ตรงทุกเงื่อนไข</h3><p>ระบบจะไม่ผ่อนตัวกรองให้อัตโนมัติ ลองเปลี่ยนคำค้นหรือช่วงเวลาที่เลือก</p><button type="button" onClick={clearEverything}>ล้างการค้นหาและตัวกรอง</button></div>}
          {!isLoading && !loadError && products.length > 0 && <div className="catalog-grid">{products.map((product) => <ProductCard {...cardProps} key={product.id} product={product} />)}</div>}
          {!isLoading && !loadError && catalog && catalog.nextOffset !== null && <div className="catalog-load-more"><p>แสดง {numberFormatter.format(products.length)} จาก {numberFormatter.format(catalog.matched)} รายการ</p><button disabled={isLoadingMore} type="button" onClick={loadMore}>{isLoadingMore ? "กำลังโหลด…" : `โหลดเพิ่มอีก ${numberFormatter.format(Math.min(PAGE_SIZE, catalog.matched - products.length))} รายการ`}</button></div>}
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
        <div className="catalog-filter-dialog__heading"><div><span>ปรับผลลัพธ์</span><h2 id="catalog-filter-title">ตัวกรองสินค้า{activeCount ? ` (${activeCount})` : ""}</h2></div><button type="button" onClick={closeFilters} aria-label="ปิดตัวกรอง">×</button></div>
        <FilterFields idPrefix="mobile" {...filterProps} />
        <button className="catalog-filter-apply" disabled={isLoading} type="button" onClick={closeFilters}>{isLoading ? "กำลังค้นหา…" : `ดู ${numberFormatter.format(catalog?.matched ?? 0)} รายการ`}</button>
      </dialog>

      <div className={toast ? "catalog-toast catalog-toast--show" : "catalog-toast"} role="status" aria-live="polite">{toast}</div>
    </main>
  );
}

const root = document.getElementById("catalog-root");
if (!root) throw new Error("Missing #catalog-root");
createRoot(root).render(<CatalogApp />);
