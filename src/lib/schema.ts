// Logical data model: the 13 relations of "Langkah Desain Konseptual ke Logikal", Step 2.1,
// with the integrity constraints of Step 2.4 (required data, domains, multiplicity,
// entity integrity, referential integrity).

export type ColType = 'int' | 'text' | 'money' | 'bool' | 'date' | 'datetime' | 'enum' | 'decimal';
export type OnDelete = 'RESTRICT' | 'CASCADE' | 'SET NULL';

export interface Column {
  name: string;
  type: ColType;
  label: string;
  required?: boolean; // NOT NULL
  max?: number; // VARCHAR length / CHAR length
  exact?: number; // CHAR(n) exact length
  values?: readonly string[]; // ENUM
  min?: number;
  maxValue?: number;
  pattern?: RegExp;
  patternHint?: string;
  auto?: boolean; // AUTO_INCREMENT surrogate key
}

export interface ForeignKey {
  columns: string[];
  refTable: TableName;
  refColumns: string[];
  onDelete: OnDelete;
  nullable: boolean;
}

export interface Check {
  name: string;
  test: (row: Row) => boolean;
  message: string;
}

export interface TableDef {
  name: TableName;
  label: string;
  pk: string[];
  columns: Column[];
  unique: string[][]; // alternate keys
  fks: ForeignKey[];
  checks: Check[];
}

export type Row = Record<string, any>;

export const TABLES = [
  'customer',
  'membership',
  'customer_address',
  'category',
  'product',
  'promo_code',
  'orders',
  'order_item',
  'payment',
  'shipment',
  'review',
  'warranty_claim',
  'store',
] as const;
export type TableName = (typeof TABLES)[number];

export const ENUMS = {
  club_tier: ['member', 'vip', 'all_access'],
  discount_type: ['percentage', 'fixed_amount'],
  order_type: ['regular', 'warranty_replacement'],
  order_status: ['pending', 'confirmed', 'completed', 'cancelled'],
  payment_method: ['bca_va', 'mandiri_va', 'gopay', 'ovo', 'qris', 'credit_card'],
  payment_status: ['pending', 'paid', 'failed', 'expired'],
  shipping_service: ['jne_reg', 'jne_yes', 'sicepat_best', 'gosend_same_day', 'jt_ez'],
  shipment_status: ['awaiting_payment', 'packed', 'shipped', 'delivered', 'cancelled'],
  claim_status: ['submitted', 'under_review', 'approved', 'rejected'],
} as const;

const POSTAL = { pattern: /^\d{5}$/, patternHint: '5 digit angka' };
const PHONE = { pattern: /^\+?[0-9 -]{8,20}$/, patternHint: 'angka, 8–20 karakter' };
const EMAIL = { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternHint: 'format email' };
const SLUG = { pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/, patternHint: 'huruf kecil, angka, tanda hubung' };

const id = (name: string, label = 'ID'): Column => ({ name, type: 'int', label, required: true, auto: true });
const fkCol = (name: string, label: string, required = true): Column => ({ name, type: 'int', label, required });

const isSet = (v: unknown) => v !== null && v !== undefined && v !== '';

export const SCHEMA: Record<TableName, TableDef> = {
  customer: {
    name: 'customer',
    label: 'Customer',
    pk: ['customer_id'],
    columns: [
      id('customer_id'),
      { name: 'full_name', type: 'text', label: 'Nama lengkap', required: true, max: 100 },
      { name: 'email', type: 'text', label: 'Email', required: true, max: 100, ...EMAIL },
      { name: 'phone', type: 'text', label: 'Telepon', required: true, max: 20, ...PHONE },
      { name: 'created_at', type: 'datetime', label: 'Dibuat', required: true },
    ],
    unique: [['email']],
    fks: [],
    checks: [],
  },
  membership: {
    name: 'membership',
    label: 'Membership',
    pk: ['membership_id'],
    columns: [
      id('membership_id'),
      fkCol('customer_id', 'Customer'),
      { name: 'password_hash', type: 'text', label: 'Password hash', required: true, exact: 60 },
      { name: 'birth_date', type: 'date', label: 'Tanggal lahir' },
      { name: 'tier', type: 'enum', label: 'Tier', required: true, values: ENUMS.club_tier },
      { name: 'tier_valid_until', type: 'date', label: 'Tier berlaku s.d.' },
      { name: 'total_points', type: 'int', label: 'Total poin', required: true, min: 0 },
      { name: 'registered_at', type: 'datetime', label: 'Terdaftar', required: true },
    ],
    unique: [['customer_id']],
    fks: [{ columns: ['customer_id'], refTable: 'customer', refColumns: ['customer_id'], onDelete: 'CASCADE', nullable: false }],
    checks: [],
  },
  customer_address: {
    name: 'customer_address',
    label: 'CustomerAddress',
    pk: ['customer_address_id'],
    columns: [
      id('customer_address_id'),
      fkCol('membership_id', 'Membership'),
      { name: 'label', type: 'text', label: 'Label', required: true, max: 30 },
      { name: 'recipient_name', type: 'text', label: 'Penerima', required: true, max: 100 },
      { name: 'recipient_phone', type: 'text', label: 'Telepon penerima', required: true, max: 20, ...PHONE },
      { name: 'street_address', type: 'text', label: 'Alamat jalan', required: true, max: 255 },
      { name: 'city', type: 'text', label: 'Kota', required: true, max: 50 },
      { name: 'province', type: 'text', label: 'Provinsi', required: true, max: 50 },
      { name: 'postal_code', type: 'text', label: 'Kode pos', required: true, exact: 5, ...POSTAL },
    ],
    unique: [],
    fks: [{ columns: ['membership_id'], refTable: 'membership', refColumns: ['membership_id'], onDelete: 'CASCADE', nullable: false }],
    checks: [],
  },
  category: {
    name: 'category',
    label: 'Category',
    pk: ['category_id'],
    columns: [
      id('category_id'),
      fkCol('parent_category_id', 'Induk kategori', false),
      { name: 'name', type: 'text', label: 'Nama', required: true, max: 50 },
      { name: 'slug', type: 'text', label: 'Slug', required: true, max: 60, ...SLUG },
    ],
    unique: [['slug']],
    fks: [{ columns: ['parent_category_id'], refTable: 'category', refColumns: ['category_id'], onDelete: 'RESTRICT', nullable: true }],
    checks: [
      {
        name: 'chk_category_not_self_parent',
        test: (r) => !isSet(r.parent_category_id) || r.parent_category_id !== r.category_id,
        message: 'Kategori tidak boleh menjadi induk dirinya sendiri.',
      },
    ],
  },
  product: {
    name: 'product',
    label: 'Product',
    pk: ['product_id'],
    columns: [
      id('product_id'),
      fkCol('category_id', 'Kategori'),
      { name: 'sku', type: 'text', label: 'SKU', required: true, max: 30 },
      { name: 'name', type: 'text', label: 'Nama produk', required: true, max: 150 },
      { name: 'description', type: 'text', label: 'Deskripsi', max: 1000 },
      { name: 'color', type: 'text', label: 'Warna', required: true, max: 50 },
      { name: 'size', type: 'text', label: 'Ukuran', required: true, max: 20 },
      { name: 'price', type: 'money', label: 'Harga', required: true, min: 0 },
      { name: 'compare_at_price', type: 'money', label: 'Harga coret', min: 0 },
      { name: 'stock_qty', type: 'int', label: 'Stok', required: true, min: 0 },
      { name: 'image_url', type: 'text', label: 'Gambar' },
      { name: 'is_promo_eligible', type: 'bool', label: 'Boleh promo', required: true },
      { name: 'is_active', type: 'bool', label: 'Aktif', required: true },
    ],
    unique: [['sku']],
    fks: [{ columns: ['category_id'], refTable: 'category', refColumns: ['category_id'], onDelete: 'RESTRICT', nullable: false }],
    checks: [
      {
        name: 'chk_compare_at_price_gt_price',
        test: (r) => !isSet(r.compare_at_price) || Number(r.compare_at_price) > Number(r.price),
        message: 'Harga coret (compare_at_price) harus lebih besar daripada harga (price).',
      },
    ],
  },
  promo_code: {
    name: 'promo_code',
    label: 'PromoCode',
    pk: ['promo_code_id'],
    columns: [
      id('promo_code_id'),
      fkCol('membership_id', 'Pemilik (member)', false),
      { name: 'code', type: 'text', label: 'Kode', required: true, max: 30, pattern: /^[A-Z0-9-]+$/, patternHint: 'huruf kapital, angka, tanda hubung' },
      { name: 'discount_type', type: 'enum', label: 'Jenis diskon', required: true, values: ENUMS.discount_type },
      { name: 'discount_value', type: 'money', label: 'Nilai diskon', required: true, min: 0 },
      { name: 'max_discount', type: 'money', label: 'Maks. diskon', min: 0 },
      { name: 'min_purchase', type: 'money', label: 'Min. belanja', required: true, min: 0 },
      { name: 'starts_at', type: 'datetime', label: 'Mulai', required: true },
      { name: 'ends_at', type: 'datetime', label: 'Berakhir', required: true },
      { name: 'usage_limit', type: 'int', label: 'Batas pemakaian', min: 1 },
    ],
    unique: [['code']],
    fks: [{ columns: ['membership_id'], refTable: 'membership', refColumns: ['membership_id'], onDelete: 'CASCADE', nullable: true }],
    checks: [
      {
        name: 'chk_ends_after_starts',
        test: (r) => !isSet(r.starts_at) || !isSet(r.ends_at) || r.ends_at > r.starts_at,
        message: 'Waktu berakhir (ends_at) harus setelah waktu mulai (starts_at).',
      },
      {
        name: 'chk_percentage_le_100',
        test: (r) => r.discount_type !== 'percentage' || Number(r.discount_value) <= 100,
        message: 'Diskon persentase maksimal 100.',
      },
    ],
  },
  orders: {
    name: 'orders',
    label: 'Orders',
    pk: ['order_id'],
    columns: [
      id('order_id'),
      fkCol('customer_id', 'Customer'),
      fkCol('promo_code_id', 'Kode promo', false),
      { name: 'order_number', type: 'text', label: 'No. pesanan', required: true, max: 20 },
      { name: 'order_type', type: 'enum', label: 'Tipe', required: true, values: ENUMS.order_type },
      { name: 'status', type: 'enum', label: 'Status', required: true, values: ENUMS.order_status },
      { name: 'discount_amount', type: 'money', label: 'Diskon', required: true, min: 0 },
      { name: 'shipping_cost', type: 'money', label: 'Ongkir', required: true, min: 0 },
      { name: 'ordered_at', type: 'datetime', label: 'Dipesan', required: true },
    ],
    unique: [['order_number']],
    fks: [
      { columns: ['customer_id'], refTable: 'customer', refColumns: ['customer_id'], onDelete: 'RESTRICT', nullable: false },
      { columns: ['promo_code_id'], refTable: 'promo_code', refColumns: ['promo_code_id'], onDelete: 'RESTRICT', nullable: true },
    ],
    checks: [
      {
        name: 'chk_replacement_is_free',
        test: (r) => r.order_type !== 'warranty_replacement' || (Number(r.discount_amount) === 0 && Number(r.shipping_cost) === 0 && !isSet(r.promo_code_id)),
        message: 'Pesanan warranty_replacement harus bernilai Rp0 tanpa kode promo.',
      },
    ],
  },
  order_item: {
    name: 'order_item',
    label: 'OrderItem',
    pk: ['order_id', 'product_id'],
    columns: [
      fkCol('order_id', 'Pesanan'),
      fkCol('product_id', 'Produk'),
      { name: 'quantity', type: 'int', label: 'Qty', required: true, min: 1 },
      { name: 'unit_price', type: 'money', label: 'Harga satuan', required: true, min: 0 },
    ],
    unique: [],
    fks: [
      { columns: ['order_id'], refTable: 'orders', refColumns: ['order_id'], onDelete: 'CASCADE', nullable: false },
      { columns: ['product_id'], refTable: 'product', refColumns: ['product_id'], onDelete: 'RESTRICT', nullable: false },
    ],
    checks: [],
  },
  payment: {
    name: 'payment',
    label: 'Payment',
    pk: ['payment_id'],
    columns: [
      id('payment_id'),
      fkCol('order_id', 'Pesanan'),
      { name: 'method', type: 'enum', label: 'Metode', required: true, values: ENUMS.payment_method },
      { name: 'amount', type: 'money', label: 'Jumlah', required: true, min: 0 },
      { name: 'status', type: 'enum', label: 'Status', required: true, values: ENUMS.payment_status },
      { name: 'reference_no', type: 'text', label: 'No. referensi', required: true, max: 20 },
      { name: 'paid_at', type: 'datetime', label: 'Dibayar' },
    ],
    unique: [['order_id'], ['reference_no']],
    fks: [{ columns: ['order_id'], refTable: 'orders', refColumns: ['order_id'], onDelete: 'CASCADE', nullable: false }],
    checks: [
      {
        name: 'chk_paid_has_paid_at',
        test: (r) => r.status !== 'paid' || isSet(r.paid_at),
        message: 'Payment berstatus paid wajib punya paid_at.',
      },
    ],
  },
  shipment: {
    name: 'shipment',
    label: 'Shipment',
    pk: ['shipment_id'],
    columns: [
      id('shipment_id'),
      fkCol('order_id', 'Pesanan'),
      { name: 'shipping_service', type: 'enum', label: 'Layanan', required: true, values: ENUMS.shipping_service },
      { name: 'recipient_name', type: 'text', label: 'Penerima', required: true, max: 100 },
      { name: 'recipient_phone', type: 'text', label: 'Telepon', required: true, max: 20, ...PHONE },
      { name: 'street_address', type: 'text', label: 'Alamat', required: true, max: 255 },
      { name: 'city', type: 'text', label: 'Kota', required: true, max: 50 },
      { name: 'province', type: 'text', label: 'Provinsi', required: true, max: 50 },
      { name: 'postal_code', type: 'text', label: 'Kode pos', required: true, exact: 5, ...POSTAL },
      { name: 'tracking_number', type: 'text', label: 'No. resi', max: 20 },
      { name: 'status', type: 'enum', label: 'Status', required: true, values: ENUMS.shipment_status },
      { name: 'shipped_at', type: 'datetime', label: 'Dikirim' },
      { name: 'delivered_at', type: 'datetime', label: 'Diterima' },
    ],
    unique: [['order_id']],
    fks: [{ columns: ['order_id'], refTable: 'orders', refColumns: ['order_id'], onDelete: 'CASCADE', nullable: false }],
    checks: [
      {
        name: 'chk_shipped_has_tracking',
        test: (r) => !['shipped', 'delivered'].includes(r.status) || isSet(r.tracking_number),
        message: 'Shipment shipped/delivered wajib punya tracking_number.',
      },
      {
        name: 'chk_delivered_after_shipped',
        test: (r) => !isSet(r.delivered_at) || !isSet(r.shipped_at) || r.delivered_at >= r.shipped_at,
        message: 'delivered_at tidak boleh sebelum shipped_at.',
      },
    ],
  },
  review: {
    name: 'review',
    label: 'Review',
    pk: ['customer_id', 'product_id'],
    columns: [
      fkCol('customer_id', 'Customer'),
      fkCol('product_id', 'Produk'),
      { name: 'rating', type: 'int', label: 'Rating', required: true, min: 1, maxValue: 5 },
      { name: 'title', type: 'text', label: 'Judul', required: true, max: 100 },
      { name: 'comment', type: 'text', label: 'Komentar', max: 1000 },
      { name: 'created_at', type: 'datetime', label: 'Dibuat', required: true },
    ],
    unique: [],
    fks: [
      { columns: ['customer_id'], refTable: 'customer', refColumns: ['customer_id'], onDelete: 'CASCADE', nullable: false },
      { columns: ['product_id'], refTable: 'product', refColumns: ['product_id'], onDelete: 'CASCADE', nullable: false },
    ],
    checks: [],
  },
  warranty_claim: {
    name: 'warranty_claim',
    label: 'WarrantyClaim',
    pk: ['warranty_claim_id'],
    columns: [
      id('warranty_claim_id'),
      fkCol('customer_id', 'Customer'),
      fkCol('product_id', 'Produk'),
      fkCol('order_id', 'Pesanan asal', false),
      fkCol('replacement_order_id', 'Pesanan pengganti', false),
      fkCol('store_id', 'Store', false),
      { name: 'claim_number', type: 'text', label: 'No. klaim', required: true, max: 20 },
      { name: 'purchase_place', type: 'text', label: 'Tempat beli', required: true, max: 100 },
      { name: 'purchase_date', type: 'date', label: 'Tanggal beli' },
      { name: 'date_code', type: 'text', label: 'Date code', required: true, exact: 4, pattern: /^[0-9A-Z]{4}$/, patternHint: '4 karakter' },
      { name: 'issue_description', type: 'text', label: 'Deskripsi masalah', required: true, max: 1000 },
      { name: 'status', type: 'enum', label: 'Status', required: true, values: ENUMS.claim_status },
      { name: 'rejection_reason', type: 'text', label: 'Alasan ditolak', max: 255 },
      { name: 'photo_full_url', type: 'text', label: 'Foto utuh', required: true, max: 255 },
      { name: 'photo_bottom_url', type: 'text', label: 'Foto bawah', required: true, max: 255 },
      { name: 'photo_defect_url', type: 'text', label: 'Foto kerusakan', required: true, max: 255 },
      { name: 'submitted_at', type: 'datetime', label: 'Diajukan', required: true },
      { name: 'resolved_at', type: 'datetime', label: 'Diselesaikan' },
    ],
    unique: [['replacement_order_id'], ['claim_number']],
    fks: [
      { columns: ['customer_id'], refTable: 'customer', refColumns: ['customer_id'], onDelete: 'RESTRICT', nullable: false },
      { columns: ['product_id'], refTable: 'product', refColumns: ['product_id'], onDelete: 'RESTRICT', nullable: false },
      { columns: ['order_id', 'product_id'], refTable: 'order_item', refColumns: ['order_id', 'product_id'], onDelete: 'RESTRICT', nullable: true },
      { columns: ['replacement_order_id'], refTable: 'orders', refColumns: ['order_id'], onDelete: 'SET NULL', nullable: true },
      { columns: ['store_id'], refTable: 'store', refColumns: ['store_id'], onDelete: 'SET NULL', nullable: true },
    ],
    checks: [
      {
        name: 'chk_claim_purchase_source',
        test: (r) => isSet(r.order_id) || isSet(r.purchase_date),
        message: 'Klaim pembelian di luar website wajib mengisi purchase_date; pembelian di website wajib order_id.',
      },
      {
        name: 'chk_rejected_has_reason',
        test: (r) => r.status !== 'rejected' || isSet(r.rejection_reason),
        message: 'Klaim berstatus rejected wajib punya rejection_reason.',
      },
    ],
  },
  store: {
    name: 'store',
    label: 'Store',
    pk: ['store_id'],
    columns: [
      id('store_id'),
      { name: 'retailer_name', type: 'text', label: 'Retailer', required: true, max: 100 },
      { name: 'store_name', type: 'text', label: 'Nama toko', required: true, max: 100 },
      { name: 'street_address', type: 'text', label: 'Alamat', required: true, max: 255 },
      { name: 'city', type: 'text', label: 'Kota', required: true, max: 50 },
      { name: 'province', type: 'text', label: 'Provinsi', required: true, max: 50 },
      { name: 'postal_code', type: 'text', label: 'Kode pos', required: true, exact: 5, ...POSTAL },
      { name: 'phone', type: 'text', label: 'Telepon', required: true, max: 20, ...PHONE },
      { name: 'latitude', type: 'decimal', label: 'Latitude', required: true, min: -90, maxValue: 90 },
      { name: 'longitude', type: 'decimal', label: 'Longitude', required: true, min: -180, maxValue: 180 },
      { name: 'opening_hours', type: 'text', label: 'Jam buka', required: true, max: 255 },
    ],
    unique: [],
    fks: [],
    checks: [],
  },
};

/** Insert order that satisfies every FK (parents first). */
export const INSERT_ORDER: TableName[] = [
  'customer',
  'membership',
  'customer_address',
  'category',
  'product',
  'promo_code',
  'store',
  'orders',
  'order_item',
  'payment',
  'shipment',
  'review',
  'warranty_claim',
];

export const ENUM_LABELS: Record<string, string> = {
  member: 'Member',
  vip: 'VIP',
  all_access: 'All-Access',
  percentage: 'Persentase',
  fixed_amount: 'Nominal',
  regular: 'Reguler',
  warranty_replacement: 'Pengganti garansi',
  pending: 'Menunggu',
  confirmed: 'Dikonfirmasi',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
  bca_va: 'BCA Virtual Account',
  mandiri_va: 'Mandiri Virtual Account',
  gopay: 'GoPay',
  ovo: 'OVO',
  qris: 'QRIS',
  credit_card: 'Kartu kredit',
  paid: 'Lunas',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
  jne_reg: 'JNE REG',
  jne_yes: 'JNE YES',
  sicepat_best: 'SiCepat BEST',
  gosend_same_day: 'GoSend Same Day',
  jt_ez: 'J&T EZ',
  awaiting_payment: 'Menunggu bayar',
  packed: 'Dikemas',
  shipped: 'Dikirim',
  delivered: 'Diterima',
  submitted: 'Diajukan',
  under_review: 'Ditinjau',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

export const SHIPPING_COST: Record<string, number> = {
  jne_reg: 18000,
  jne_yes: 32000,
  sicepat_best: 25000,
  gosend_same_day: 45000,
  jt_ez: 16000,
};
