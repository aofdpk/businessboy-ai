import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Gen3Analytics, trackGen3Event } from "./analytics";

type CatalogProduct = {
  id: string;
  rank: number | null;
  category: string;
  categoryKey: string;
  categoryGroup: string;
  categoryGroupKey: string;
  subcategory: string;
  subcategoryKey: string;
  imageUrl: string;
  cleanName: string;
  summary: string;
  priceMin: number | null;
  priceMax: number | null;
  priceType: "fixed" | "range";
  checkedAt: string;
  productUrl: string;
  featured: boolean;
  shopName?: string;
  seasonTags: string[];
  monthTags: number[];
  seasonalScore: number;
  seasonReason: string;
  periodMatch: {
    period: string;
    kind: "none" | "peak" | "evergreen-fallback" | "season" | "evergreen";
    score: number;
    reason: string;
    badge: string;
  };
  itemSold: number | null;
  rating: number | null;
  shopRating: number | null;
  shopType: "official" | "preferred" | "general";
  stockStatus: "in-stock" | "unknown";
  reasonBadges: string[];
  safetyNotice: string;
};

type SubcategoryFacet = { key: string; label: string; count: number; available: boolean };
type CategoryFacet = { key: string; label: string; count: number; available: boolean; subcategories: SubcategoryFacet[] };
type GroupFacet = { key: string; label: string; count: number; available: boolean; categories: CategoryFacet[] };
type SeasonFacet = { key: string; label: string; count: number; available: boolean };
type MonthFacet = { month: number; count: number; peakCount: number; evergreenFallbackCount: number; available: boolean };
type PeriodSummary = {
  period: string;
  mode: "month-with-evergreen-fallback" | "exact";
  peakMatches: number;
  evergreenFallbackMatches: number;
  exactMatches: number;
  total: number;
};

type CatalogResponse = {
  schemaVersion: number;
  generatedAt: string;
  total: number;
  matched: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
  nextCursor: string | null;
  featured: CatalogProduct[];
  items: CatalogProduct[];
  facets: {
    groups: GroupFacet[];
    seasons: SeasonFacet[];
    months: MonthFacet[];
    shopTypes: Array<{ key: string; count: number; available: boolean }>;
  };
  periodSummary: PeriodSummary | null;
};

type PriceFilter = "all" | "under-100" | "100-300" | "301-500" | "501-1000" | "over-1000";
type SortMode = "recommended" | "sold-desc" | "rating-desc" | "price-asc" | "price-desc" | "seasonal" | "newest";
type PeriodFilter = "all" | "all-year" | "hot" | "rainy" | "cool" | `month-${number}`;
type ShopTypeFilter = "all" | "official" | "preferred" | "general";
type StockFilter = "all" | "in-stock";
type FreshnessFilter = 0 | 7 | 30 | 90;

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
  "all-year": "ไม่เน้นฤดูกาล",
  hot: "หน้าร้อน/ช่วงอากาศร้อน",
  rainy: "หน้าฝน/ช่วงฝน",
  cool: "หน้าหนาว/ช่วงอากาศเย็น",
};
const SORT_LABELS: Record<SortMode, string> = {
  recommended: "น่าขาย",
  "sold-desc": "ยอดขายสะสมสูง",
  "rating-desc": "คะแนนสูง",
  "price-asc": "ราคาต่ำไปสูง",
  "price-desc": "ราคาสูงไปต่ำ",
  seasonal: "เหมาะกับช่วงนี้",
  newest: "ตรวจข้อมูลล่าสุด",
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

function periodLabel(period: PeriodFilter) {
  if (period.startsWith("month-")) {
    const month = Number(period.slice("month-".length));
    return MONTH_LABELS[month - 1] || "เดือนที่เลือก";
  }
  return PERIOD_LABELS[period] || "ช่วงเวลาที่เลือก";
}

function seasonalSortLabel(period: PeriodFilter) {
  if (period === "all") return "เลือกช่วงเวลาก่อน";
  if (period === "all-year") return "ไม่เน้นฤดูกาลก่อน";
  if (period.startsWith("month-")) return `เหมาะกับเดือน${periodLabel(period)}ก่อน`;
  return `เหมาะกับ${periodLabel(period)}ก่อน`;
}

function buildCatalogUrl(filters: {
  query: string; group: string; category: string; subcategory: string; period: PeriodFilter; price: PriceFilter;
  sort: SortMode; minSold: number; minRating: number; shopType: ShopTypeFilter; stock: StockFilter;
  freshness: FreshnessFilter; cursor: string;
}) {
  const params = new URLSearchParams({
    q: filters.query,
    group: filters.group,
    category: filters.category,
    subcategory: filters.subcategory,
    period: filters.period,
    price: filters.price,
    sort: filters.sort,
    minSold: String(filters.minSold),
    minRating: String(filters.minRating),
    shopType: filters.shopType,
    stock: filters.stock,
    freshness: String(filters.freshness),
    limit: String(PAGE_SIZE),
  });
  if (filters.cursor) params.set("cursor", filters.cursor);
  return `/api/gen3-products?${params.toString()}`;
}

function formatPrice(product: CatalogProduct) {
  const min = product.priceMin;
  const max = product.priceMax;
  if (min === null && max === null) return "ยังไม่พบราคา";
  const first = min ?? max ?? 0;
  const last = max ?? min ?? first;
  if (Math.abs(first - last) < 0.001) return `฿${numberFormatter.format(first)}`;
  return `฿${numberFormatter.format(Math.min(first, last))}–฿${numberFormatter.format(Math.max(first, last))} ตามตัวเลือก`;
}

function formatSold(value: number | null) {
  return value === null ? "ยังไม่พบยอดขายใน Feed" : `ยอดขายสะสม ${numberFormatter.format(value)}`;
}

function formatRating(value: number | null) {
  return value === null ? "ยังไม่พบคะแนน" : `★ ${numberFormatter.format(value)}`;
}

function shopTypeLabel(value: CatalogProduct["shopType"]) {
  if (value === "official") return "ร้าน Official";
  if (value === "preferred") return "ร้าน Preferred";
  return "ร้านทั่วไป";
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
  showRank?: boolean;
  eager?: boolean;
  copiedKey: string;
  onCopy: (key: string, value: string, label: string, copyType: "name" | "summary" | "summary_price") => void;
  onPreview: (product: CatalogProduct) => void;
};

function ProductActions({ product, imageFailed, copiedKey, onCopy, onPreview }: CardProps & { imageFailed: boolean }) {
  const nameKey = `${product.id}:name`;
  const summaryKey = `${product.id}:summary`;
  const summaryPriceKey = `${product.id}:summary-price`;
  const canCopySummaryPrice = Boolean(product.summary) && hasAvailablePrice(product);
  const noticeLine = product.safetyNotice ? `\nหมายเหตุ: ${product.safetyNotice}` : "";
  const summaryText = `${product.summary}${noticeLine}`;
  const summaryPrice = `รายละเอียดสินค้า: ${product.summary}\nราคาปัจจุบัน: ${formatPrice(product)}${noticeLine}`;
  const downloadHref = `/api/gen3-product-image?id=${encodeURIComponent(product.id)}`;
  return (
    <div className="catalog-card__actions">
      <button aria-label={`${imageFailed ? "ดูรูปไม่ได้" : "ดูรูปใหญ่"}: ${product.cleanName}`} className="catalog-action" disabled={imageFailed} type="button" onClick={() => onPreview(product)}>{imageFailed ? "ดูรูปไม่ได้" : "ดูรูปใหญ่"}</button>
      {imageFailed ? (
        <span className="catalog-action catalog-action--disabled" aria-disabled="true">ดาวน์โหลดไม่ได้</span>
      ) : (
        <a aria-label={`ดาวน์โหลดรูป ${product.cleanName}`} className="catalog-action" href={downloadHref} onClick={() => trackGen3Event("product_image_download_clicked")}>ดาวน์โหลดรูป</a>
      )}
      <button aria-label={`${copiedKey === nameKey ? "คัดลอกชื่อแล้ว" : "คัดลอกชื่อ"}: ${product.cleanName}`} className="catalog-action" type="button" onClick={() => onCopy(nameKey, product.cleanName, "ชื่อสินค้า", "name")}>
        {copiedKey === nameKey ? "คัดลอกแล้ว ✓" : "คัดลอกชื่อ"}
      </button>
      <button
        aria-label={`${copiedKey === summaryKey ? "คัดลอกรายละเอียดแล้ว" : "คัดลอกรายละเอียด"}: ${product.cleanName}`}
        className="catalog-action"
        disabled={!product.summary}
        type="button"
        onClick={() => onCopy(summaryKey, summaryText, "รายละเอียดสินค้า", "summary")}
      >
        {copiedKey === summaryKey ? "คัดลอกแล้ว ✓" : "คัดลอกรายละเอียด"}
      </button>
      <button
        aria-label={`${copiedKey === summaryPriceKey ? "คัดลอกรายละเอียดพร้อมราคาแล้ว" : "คัดลอกรายละเอียดพร้อมราคา"}: ${product.cleanName}`}
        className="catalog-action catalog-action--summary-price"
        disabled={!canCopySummaryPrice}
        type="button"
        onClick={() => onCopy(summaryPriceKey, summaryPrice, "รายละเอียดพร้อมราคา", "summary_price")}
      >
        {copiedKey === summaryPriceKey ? "คัดลอกแล้ว ✓" : "คัดลอกรายละเอียดพร้อมราคา"}
      </button>
      <a aria-label={`เปิด ${product.cleanName} ใน Shopee`} className="catalog-action catalog-action--shopee" href={product.productUrl} onClick={() => trackGen3Event("product_shopee_opened")} rel="noopener noreferrer" target="_blank">เปิด Shopee ↗</a>
    </div>
  );
}

function ProductCard(props: CardProps) {
  const { product, featured = false, showRank = false, eager = false } = props;
  const [imageFailed, setImageFailed] = useState(false);
  const headingId = `catalog-product-${product.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <article aria-labelledby={headingId} className={featured ? "catalog-card catalog-card--featured" : "catalog-card"}>
      <div className="catalog-card__media">
        <ProductImage eager={featured || eager} onError={() => setImageFailed(true)} product={product} />
        {featured && <span className="catalog-card__recommended">สินค้าแนะนำจาก BusinessBoy</span>}
      </div>
      <div className="catalog-card__body">
        <div className="catalog-card__meta">
          <span>{product.subcategory || product.category}</span>
          {featured ? <b>แนะนำ</b> : showRank && product.rank !== null ? <b>#{numberFormatter.format(product.rank)}</b> : <b>น่าขาย</b>}
        </div>
        <h3 id={headingId}>{product.cleanName}</h3>
        {featured && product.shopName && <p className="catalog-card__shop">ร้าน {product.shopName}</p>}
        <p className="catalog-card__summary">{product.summary || "ยังไม่มีรายละเอียดสรุป"}</p>
        {!featured && <div className="catalog-card__signals" aria-label="สัญญาณประกอบการคัดเลือก">
          <span>{formatRating(product.rating)}</span>
          <span>{formatSold(product.itemSold)}</span>
          <span>{shopTypeLabel(product.shopType)}</span>
        </div>}
        {!featured && product.periodMatch?.kind !== "none" && <p className={`catalog-card__period-match catalog-card__period-match--${product.periodMatch.kind}`}>
          <b>{product.periodMatch.badge}</b><span>{product.periodMatch.reason}</span>
        </p>}
        {!featured && product.reasonBadges?.length > 0 && <div className="catalog-card__badges" aria-label="เหตุผลที่แนะนำ">
          {product.reasonBadges.filter((badge) => badge !== product.periodMatch?.badge).slice(0, product.periodMatch?.kind !== "none" ? 2 : 3).map((badge) => <span key={badge}>{badge}</span>)}
        </div>}
        {!featured && product.safetyNotice && <p className="catalog-card__notice">{product.safetyNotice}</p>}
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
  groups: GroupFacet[];
  seasonFacets: SeasonFacet[];
  monthFacets: MonthFacet[];
  shopFacets: Array<{ key: string; count: number; available: boolean }>;
  group: string;
  category: string;
  subcategory: string;
  period: PeriodFilter;
  priceFilter: PriceFilter;
  sortMode: SortMode;
  minSold: number;
  minRating: number;
  shopType: ShopTypeFilter;
  stock: StockFilter;
  freshness: FreshnessFilter;
  activeCount: number;
  onGroup: (value: string) => void;
  onCategory: (value: string) => void;
  onSubcategory: (value: string) => void;
  onPeriod: (value: PeriodFilter) => void;
  onPrice: (value: PriceFilter) => void;
  onSort: (value: SortMode) => void;
  onMinSold: (value: number) => void;
  onMinRating: (value: number) => void;
  onShopType: (value: ShopTypeFilter) => void;
  onStock: (value: StockFilter) => void;
  onFreshness: (value: FreshnessFilter) => void;
  onClear: () => void;
};

function FilterFields(props: FilterFieldsProps) {
  const currentMonth = CURRENT_BANGKOK_MONTH;
  const selectedGroup = props.groups.find((item) => item.key === props.group);
  const categories = selectedGroup?.categories ?? (props.group === "all" ? props.groups.flatMap((item) => item.categories) : []);
  const selectedCategory = categories.find((item) => item.key === props.category);
  const subcategories = (selectedCategory?.subcategories ?? []).filter((item) => item.key !== selectedCategory?.key || item.label !== selectedCategory?.label);
  function seasonFacet(key: string) {
    return props.seasonFacets.find((item) => item.key === key) ?? { key, label: "", count: 0, available: false };
  }
  function monthFacet(month: number) {
    return props.monthFacets.find((item) => item.month === month) ?? { month, count: 0, peakCount: 0, evergreenFallbackCount: 0, available: false };
  }
  function shopFacet(key: string) {
    return props.shopFacets.find((item) => item.key === key) ?? { key, count: 0, available: false };
  }
  return (
    <div className="catalog-filter-fields">
      <label htmlFor={`${props.idPrefix}-group`}><span>หมวดหลัก</span>
        <select id={`${props.idPrefix}-group`} value={props.group} onChange={(event) => props.onGroup(event.target.value)}>
          <option value="all">ทุกหมวดหลัก</option>
          {props.groups.map((item) => <option disabled={!item.available && props.group !== item.key} key={item.key} value={item.key}>{item.label} ({numberFormatter.format(item.count)})</option>)}
        </select>
      </label>
      <label htmlFor={`${props.idPrefix}-category`}><span>หมวดย่อย</span>
        <select id={`${props.idPrefix}-category`} value={props.category} onChange={(event) => props.onCategory(event.target.value)}>
          <option value="all">ทุกหมวดย่อย</option>
          {categories.map((item) => <option disabled={!item.available && props.category !== item.key} key={`${item.key}-${item.label}`} value={item.key}>{item.label} ({numberFormatter.format(item.count)})</option>)}
        </select>
      </label>
      {subcategories.length > 0 && <label htmlFor={`${props.idPrefix}-subcategory`}><span>ประเภทสินค้า</span>
        <select id={`${props.idPrefix}-subcategory`} value={props.subcategory} onChange={(event) => props.onSubcategory(event.target.value)}>
          <option value="all">ทุกประเภท</option>
          {subcategories.map((item) => <option disabled={!item.available && props.subcategory !== item.key} key={item.key} value={item.key}>{item.label} ({numberFormatter.format(item.count)})</option>)}
        </select>
      </label>}
      <label htmlFor={`${props.idPrefix}-period`}><span>ช่วงเวลาที่เหมาะทำคอนเทนต์</span>
        <select id={`${props.idPrefix}-period`} value={props.period} onChange={(event) => props.onPeriod(event.target.value as PeriodFilter)}>
          <option value="all">ทุกช่วงเวลา</option>
          {(["all-year", "hot", "rainy", "cool"] as const).map((value) => {
            const facet = seasonFacet(value);
            const label = value === "all-year" ? "ไม่เน้นฤดูกาล" : PERIOD_LABELS[value];
            return <option disabled={!facet.available && props.period !== value} key={value} value={value}>{label} ({numberFormatter.format(facet.count)})</option>;
          })}
          {MONTH_LABELS.map((label, index) => {
            const month = index + 1;
            const facet = monthFacet(month);
            return <option disabled={!facet.available && props.period !== `month-${month}`} key={label} value={`month-${month}`}>
              {month}. {label}{month === currentMonth ? " · เดือนนี้" : ""} ({numberFormatter.format(facet.count)} · เด่น {numberFormatter.format(facet.peakCount)})
            </option>;
          })}
        </select>
      </label>
      <label htmlFor={`${props.idPrefix}-price`}><span>ช่วงราคา</span>
        <select id={`${props.idPrefix}-price`} value={props.priceFilter} onChange={(event) => props.onPrice(event.target.value as PriceFilter)}>
          {PRICE_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label htmlFor={`${props.idPrefix}-sort`}><span>เรียงลำดับ</span>
        <select id={`${props.idPrefix}-sort`} value={props.sortMode} onChange={(event) => props.onSort(event.target.value as SortMode)}>
          <option value="recommended">น่าขาย</option>
          <option value="sold-desc">ยอดขายสะสมสูง</option>
          <option value="rating-desc">คะแนนสูง</option>
          <option value="price-asc">ราคาต่ำไปสูง</option>
          <option value="price-desc">ราคาสูงไปต่ำ</option>
          <option disabled={props.period === "all"} value="seasonal">{seasonalSortLabel(props.period)}</option>
          <option value="newest">ตรวจข้อมูลล่าสุด</option>
        </select>
      </label>
      <label htmlFor={`${props.idPrefix}-sold`}><span>ยอดขายสะสมขั้นต่ำ</span>
        <select id={`${props.idPrefix}-sold`} value={props.minSold} onChange={(event) => props.onMinSold(Number(event.target.value))}>
          <option value="0">ไม่กำหนด</option><option value="100">100 ชิ้น</option><option value="1000">1,000 ชิ้น</option><option value="10000">10,000 ชิ้น</option>
        </select>
      </label>
      <label htmlFor={`${props.idPrefix}-rating`}><span>คะแนนสินค้าขั้นต่ำ</span>
        <select id={`${props.idPrefix}-rating`} value={props.minRating} onChange={(event) => props.onMinRating(Number(event.target.value))}>
          <option value="0">ไม่กำหนด</option><option value="4.5">4.5 ขึ้นไป</option><option value="4.7">4.7 ขึ้นไป</option><option value="4.8">4.8 ขึ้นไป</option>
        </select>
      </label>
      <label htmlFor={`${props.idPrefix}-shop`}><span>ประเภทร้าน</span>
        <select id={`${props.idPrefix}-shop`} value={props.shopType} onChange={(event) => props.onShopType(event.target.value as ShopTypeFilter)}>
          <option value="all">ทุกร้าน</option>
          {(["official", "preferred", "general"] as const).map((value) => {
            const facet = shopFacet(value);
            const label = value === "official" ? "Official" : value === "preferred" ? "Preferred" : "ร้านทั่วไป";
            return <option disabled={!facet.available && props.shopType !== value} key={value} value={value}>{label} ({numberFormatter.format(facet.count)})</option>;
          })}
        </select>
      </label>
      <label htmlFor={`${props.idPrefix}-stock`}><span>สถานะสินค้า</span>
        <select id={`${props.idPrefix}-stock`} value={props.stock} onChange={(event) => props.onStock(event.target.value as StockFilter)}>
          <option value="all">ทั้งหมด</option><option value="in-stock">มีสินค้า</option>
        </select>
      </label>
      <label htmlFor={`${props.idPrefix}-freshness`}><span>ตรวจข้อมูลล่าสุด</span>
        <select id={`${props.idPrefix}-freshness`} value={props.freshness} onChange={(event) => props.onFreshness(Number(event.target.value) as FreshnessFilter)}>
          <option value="0">ไม่กำหนด</option><option value="7">ไม่เกิน 7 วัน</option><option value="30">ไม่เกิน 30 วัน</option><option value="90">ไม่เกิน 90 วัน</option>
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
  const [group, setGroup] = useState("all");
  const [category, setCategory] = useState("all");
  const [subcategory, setSubcategory] = useState("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [minSold, setMinSold] = useState(0);
  const [minRating, setMinRating] = useState(0);
  const [shopType, setShopType] = useState<ShopTypeFilter>("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [freshness, setFreshness] = useState<FreshnessFilter>(0);
  const [cursor, setCursor] = useState("");
  const [previousCursors, setPreviousCursors] = useState<string[]>([]);
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

  const filterKey = JSON.stringify([debouncedQuery, group, category, subcategory, period, priceFilter, sortMode, minSold, minRating, shopType, stock, freshness]);

  useEffect(() => {
    setCursor("");
    setPreviousCursors([]);
  }, [filterKey]);

  useEffect(() => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const sequence = ++requestSequence.current;
    setLoadError("");
    setIsLoading(true);
    setIsLoadingMore(false);
    setProducts([]);

    const url = buildCatalogUrl({
      query: debouncedQuery, group, category, subcategory, period, price: priceFilter, sort: sortMode,
      minSold, minRating, shopType, stock, freshness, cursor,
    });
    fetch(url, { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.reload();
          throw new Error("unauthorized");
        }
        if (response.status === 409) {
          const detail = await response.json().catch(() => null);
          if (detail?.code === "catalog_changed") {
            setPreviousCursors([]);
            setCursor("");
            setToast("คลังสินค้าอัปเดตแล้ว ระบบพากลับหน้าแรก");
            window.setTimeout(() => setToast(""), 2600);
            throw new Error("catalog_changed");
          }
        }
        if (!response.ok) throw new Error("โหลดรายการสินค้าไม่สำเร็จ");
        return response.json();
      })
      .then((result: CatalogResponse) => {
        if (sequence !== requestSequence.current) return;
        setCatalog(result);
        setProducts(Array.isArray(result.items) ? result.items : []);
        if (!cursor) setFeatured(Array.isArray(result.featured) ? result.featured : []);
      })
      .catch((error) => {
        if (error.name !== "AbortError" && !["unauthorized", "catalog_changed"].includes(error.message) && sequence === requestSequence.current) {
          setLoadError("เปิดคลังสินค้าไม่สำเร็จ กรุณาลองอีกครั้ง");
        }
      })
      .finally(() => {
        if (sequence === requestSequence.current) setIsLoading(false);
      });

    return () => controller.abort();
  }, [filterKey, cursor, retryCount]);

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

  const groups = catalog?.facets?.groups ?? [];
  const seasonFacets = catalog?.facets?.seasons ?? [];
  const monthFacets = catalog?.facets?.months ?? [];
  const shopFacets = catalog?.facets?.shopTypes ?? [];
  const activeCount = Number(group !== "all") + Number(category !== "all") + Number(subcategory !== "all")
    + Number(period !== "all") + Number(priceFilter !== "all") + Number(sortMode !== "recommended")
    + Number(minSold > 0) + Number(minRating > 0) + Number(shopType !== "all") + Number(stock !== "all") + Number(freshness > 0);

  function clearFilters() {
    setGroup("all");
    setCategory("all");
    setSubcategory("all");
    setPeriod("all");
    setPriceFilter("all");
    setSortMode("recommended");
    setMinSold(0);
    setMinRating(0);
    setShopType("all");
    setStock("all");
    setFreshness(0);
  }

  function clearEverything() {
    setQuery("");
    setDebouncedQuery("");
    clearFilters();
  }

  function changePeriod(value: PeriodFilter) {
    setPeriod(value);
    if (value === "all" && sortMode === "seasonal") setSortMode("recommended");
  }

  function moveResultsIntoView() {
    window.setTimeout(() => document.getElementById("results-title")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function nextPage() {
    if (!catalog?.nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setPreviousCursors((current) => [...current, cursor]);
    setCursor(catalog.nextCursor);
    moveResultsIntoView();
  }

  function previousPage() {
    if (!previousCursors.length || isLoadingMore) return;
    setIsLoadingMore(true);
    const prior = previousCursors[previousCursors.length - 1] ?? "";
    setPreviousCursors((current) => current.slice(0, -1));
    setCursor(prior);
    moveResultsIntoView();
  }

  async function handleCopy(key: string, value: string, label: string, copyType: "name" | "summary" | "summary_price") {
    try {
      await copyText(value);
      trackGen3Event("product_details_copied", { copy_type: copyType });
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
    groups,
    seasonFacets,
    monthFacets,
    shopFacets,
    group,
    category,
    subcategory,
    period,
    priceFilter,
    sortMode,
    minSold,
    minRating,
    shopType,
    stock,
    freshness,
    activeCount,
    onGroup: (value: string) => { setGroup(value); setCategory("all"); setSubcategory("all"); },
    onCategory: (value: string) => { setCategory(value); setSubcategory("all"); },
    onSubcategory: setSubcategory,
    onPeriod: changePeriod,
    onPrice: setPriceFilter,
    onSort: setSortMode,
    onMinSold: setMinSold,
    onMinRating: setMinRating,
    onShopType: setShopType,
    onStock: setStock,
    onFreshness: setFreshness,
    onClear: clearFilters,
  };

  const activeGroup = groups.find((item) => item.key === group);
  const activeCategory = activeGroup?.categories.find((item) => item.key === category)
    ?? groups.flatMap((item) => item.categories).find((item) => item.key === category);
  const activeSubcategory = activeCategory?.subcategories.find((item) => item.key === subcategory);
  const activePrice = PRICE_FILTERS.find((item) => item.value === priceFilter)?.label || "ช่วงราคาที่เลือก";
  const showRank = activeCount === 0 && !debouncedQuery && previousCursors.length === 0;

  async function logout() {
    await fetch("/api/gen3-auth", { method: "DELETE" }).catch(() => undefined);
    window.location.reload();
  }

  return (
    <main className="app-page catalog-app">
      <header className="app-header">
        <a className="brand-link" href="/gen3">
          <img alt="เด็กประกอบการ" height="64" src="/businessboy-logo.jpg" width="64" />
          <div><b>คลังสินค้าน่าขาย</b><span>สำหรับนักเรียนรุ่น 3</span></div>
        </a>
        <div className="header-message"><span>คัดจากข้อมูลสินค้าและคุณภาพร้าน</span><small>ค้นหา → ดาวน์โหลดรูป → เปิด Shopee</small></div>
        <button className="logout-button" onClick={logout} type="button">ออกจากระบบ</button>
      </header>

      <div className="catalog-shell">
        <section className="catalog-intro" aria-labelledby="catalog-title">
          <div><span className="eyebrow">PRODUCT LIBRARY · รุ่น 3</span><h1 id="catalog-title">{catalog ? `${numberFormatter.format(catalog.total)} สินค้าน่าขายสำหรับทำคลิป` : "คลังสินค้าน่าขาย"}</h1><p>คัดจากยอดขายสะสม คะแนนสินค้า คุณภาพร้าน ราคา และความเหมาะกับช่วงเวลา โดยไม่รับประกันยอดขาย</p></div>
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

        <div className="catalog-quick-filters" aria-label="ตัวกรองด่วน">
          <button className={minSold === 1000 ? "is-active" : ""} type="button" onClick={() => setMinSold(minSold === 1000 ? 0 : 1000)}>ขายสะสม 1,000+</button>
          <button className={minRating === 4.7 ? "is-active" : ""} type="button" onClick={() => setMinRating(minRating === 4.7 ? 0 : 4.7)}>คะแนน 4.7+</button>
          <button className={shopType === "official" ? "is-active" : ""} type="button" onClick={() => setShopType(shopType === "official" ? "all" : "official")}>ร้าน Official</button>
          <button className={period === `month-${CURRENT_BANGKOK_MONTH}` ? "is-active" : ""} type="button" onClick={() => changePeriod(period === `month-${CURRENT_BANGKOK_MONTH}` ? "all" : `month-${CURRENT_BANGKOK_MONTH}`)}>เหมาะเดือนนี้</button>
          <button className={stock === "in-stock" ? "is-active" : ""} type="button" onClick={() => setStock(stock === "in-stock" ? "all" : "in-stock")}>มีสินค้า</button>
        </div>

        {featured.length && previousCursors.length === 0 ? (
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
          {group !== "all" && <button type="button" onClick={() => { setGroup("all"); setCategory("all"); setSubcategory("all"); }} aria-label={`ยกเลิกหมวดหลัก ${activeGroup?.label || "ที่เลือก"}`}>{activeGroup?.label || "หมวดหลัก"} ×</button>}
          {category !== "all" && <button type="button" onClick={() => { setCategory("all"); setSubcategory("all"); }} aria-label={`ยกเลิกหมวดย่อย ${activeCategory?.label || "ที่เลือก"}`}>{activeCategory?.label || "หมวดย่อย"} ×</button>}
          {subcategory !== "all" && <button type="button" onClick={() => setSubcategory("all")} aria-label={`ยกเลิกประเภท ${activeSubcategory?.label || "ที่เลือก"}`}>{activeSubcategory?.label || "ประเภทสินค้า"} ×</button>}
          {period !== "all" && <button type="button" onClick={() => changePeriod("all")} aria-label={`ยกเลิกช่วงเวลา ${periodLabel(period)}`}>{periodLabel(period)} ×</button>}
          {priceFilter !== "all" && <button type="button" onClick={() => setPriceFilter("all")} aria-label={`ยกเลิกช่วงราคา ${activePrice}`}>{activePrice} ×</button>}
          {sortMode !== "recommended" && <button type="button" onClick={() => setSortMode("recommended")} aria-label={`ยกเลิกการเรียง ${sortMode === "seasonal" ? seasonalSortLabel(period) : SORT_LABELS[sortMode]}`}>{sortMode === "seasonal" ? seasonalSortLabel(period) : SORT_LABELS[sortMode]} ×</button>}
          {minSold > 0 && <button type="button" onClick={() => setMinSold(0)}>ยอดขายสะสม {numberFormatter.format(minSold)}+ ×</button>}
          {minRating > 0 && <button type="button" onClick={() => setMinRating(0)}>คะแนน {minRating}+ ×</button>}
          {shopType !== "all" && <button type="button" onClick={() => setShopType("all")}>{shopTypeLabel(shopType)} ×</button>}
          {stock !== "all" && <button type="button" onClick={() => setStock("all")}>มีสินค้า ×</button>}
          {freshness > 0 && <button type="button" onClick={() => setFreshness(0)}>ตรวจไม่เกิน {freshness} วัน ×</button>}
          <button className="catalog-active-filters__clear" type="button" onClick={clearFilters}>ล้างทั้งหมด</button>
        </div>}

        <section className="catalog-results" aria-labelledby="results-title" aria-busy={isLoading}>
          <div className="catalog-section-heading catalog-section-heading--results">
            <div><span>PRODUCT CATALOG</span><h2 id="results-title">รายการสินค้า</h2></div>
            <small aria-live="polite">{isLoading ? "กำลังค้นหา…" : `พบ ${numberFormatter.format(catalog?.matched ?? 0)} รายการ${debouncedQuery ? ` จากคำค้น “${debouncedQuery}”` : ""}`}</small>
          </div>

          {!isLoading && catalog?.periodSummary?.mode === "month-with-evergreen-fallback" && <div className="catalog-period-summary" role="status">
            <span><b>{numberFormatter.format(catalog.periodSummary.peakMatches)}</b> เหมาะเด่นเดือน{periodLabel(period)}</span>
            <span><b>{numberFormatter.format(catalog.periodSummary.evergreenFallbackMatches)}</b> ไม่เน้นฤดูกาล</span>
          </div>}

          {isLoading && <LoadingGrid />}
          {!isLoading && loadError && <div className="catalog-state" role="alert"><h3>เปิดคลังสินค้าไม่สำเร็จ</h3><p>ตรวจการเชื่อมต่อแล้วลองโหลดรายการอีกครั้ง</p><button type="button" onClick={() => setRetryCount((value) => value + 1)}>ลองอีกครั้ง</button></div>}
          {!isLoading && !loadError && catalog && catalog.matched === 0 && <div className="catalog-state"><h3>ไม่พบสินค้าที่ตรงทุกเงื่อนไข</h3><p>ระบบจะไม่ผ่อนตัวกรองให้อัตโนมัติ ลองเปลี่ยนคำค้นหรือช่วงเวลาที่เลือก</p><button type="button" onClick={clearEverything}>ล้างการค้นหาและตัวกรอง</button></div>}
          {!isLoading && !loadError && products.length > 0 && <div className="catalog-grid">{products.map((product, index) => <ProductCard {...cardProps} eager={index < 4} showRank={showRank} key={product.id} product={product} />)}</div>}
          {!isLoading && !loadError && catalog && (previousCursors.length > 0 || catalog.nextCursor) && <nav className="catalog-pagination" aria-label="หน้ารายการสินค้า">
            <button disabled={isLoadingMore || previousCursors.length === 0} type="button" onClick={previousPage}>← หน้าก่อน</button>
            <p>หน้า {numberFormatter.format(previousCursors.length + 1)} · แสดงครั้งละ {numberFormatter.format(products.length)} จาก {numberFormatter.format(catalog.matched)} รายการ</p>
            <button disabled={isLoadingMore || !catalog.nextCursor} type="button" onClick={nextPage}>หน้าถัดไป →</button>
          </nav>}
        </section>
      </div>

      <dialog aria-labelledby="catalog-preview-title" className="catalog-preview" ref={previewDialog} onClose={() => { setPreview(null); previousFocus.current?.focus(); }} onClick={(event) => { if (event.target === event.currentTarget) closePreview(); }}>
        {preview && <div className="catalog-preview__panel">
          <div className="catalog-preview__heading"><div><span>{preview.category}</span><h2 id="catalog-preview-title">{preview.cleanName}</h2></div><button type="button" onClick={closePreview} aria-label="ปิดรูปตัวอย่าง">×</button></div>
          <div className="catalog-preview__image">{previewFailed ? <div className="catalog-image-placeholder" role="img" aria-label={`ไม่สามารถแสดงรูป ${preview.cleanName}`}>ไม่สามารถแสดงรูปตัวอย่างได้</div> : <img alt={preview.cleanName} src={preview.imageUrl} referrerPolicy="no-referrer" onError={() => setPreviewFailed(true)} />}</div>
          <div className="catalog-preview__actions">{previewFailed ? <span aria-disabled="true">ดาวน์โหลดไม่ได้</span> : <a href={`/api/gen3-product-image?id=${encodeURIComponent(preview.id)}`} onClick={() => trackGen3Event("product_image_download_clicked")}>ดาวน์โหลดรูป</a>}<a href={preview.productUrl} onClick={() => trackGen3Event("product_shopee_opened")} target="_blank" rel="noopener noreferrer">เปิด Shopee ↗</a></div>
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
createRoot(root).render(<><CatalogApp /><Gen3Analytics /></>);
