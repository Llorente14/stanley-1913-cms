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

const POSTAL = { pattern: /^\d{5}$/, patternHint: '5 digits' };
const PHONE = { pattern: /^\+?[0-9 -]{8,20}$/, patternHint: 'digits only, 8–20 characters' };
const EMAIL = { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternHint: 'enter a valid email address' };
const SLUG = { pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/, patternHint: 'lowercase letters, numbers and hyphens' };

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
      { name: 'full_name', type: 'text', label: 'Full name', required: true, max: 100 },
      { name: 'email', type: 'text', label: 'Email', required: true, max: 100, ...EMAIL },
      { name: 'phone', type: 'text', label: 'Phone', required: true, max: 20, ...PHONE },
      { name: 'created_at', type: 'datetime', label: 'Created', required: true },
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
      { name: 'birth_date', type: 'date', label: 'Birth date' },
      { name: 'tier', type: 'enum', label: 'Tier', required: true, values: ENUMS.club_tier },
      { name: 'tier_valid_until', type: 'date', label: 'Tier valid until' },
      { name: 'total_points', type: 'int', label: 'Total points', required: true, min: 0 },
      { name: 'registered_at', type: 'datetime', label: 'Registered', required: true },
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
      { name: 'recipient_name', type: 'text', label: 'Recipient', required: true, max: 100 },
      { name: 'recipient_phone', type: 'text', label: 'Recipient phone', required: true, max: 20, ...PHONE },
      { name: 'street_address', type: 'text', label: 'Street address', required: true, max: 255 },
      { name: 'city', type: 'text', label: 'City', required: true, max: 50 },
      { name: 'province', type: 'text', label: 'Province', required: true, max: 50 },
      { name: 'postal_code', type: 'text', label: 'Postal code', required: true, exact: 5, ...POSTAL },
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
      fkCol('parent_category_id', 'Parent category', false),
      { name: 'name', type: 'text', label: 'Name', required: true, max: 50 },
      { name: 'slug', type: 'text', label: 'Slug', required: true, max: 60, ...SLUG },
    ],
    unique: [['slug']],
    fks: [{ columns: ['parent_category_id'], refTable: 'category', refColumns: ['category_id'], onDelete: 'RESTRICT', nullable: true }],
    checks: [
      {
        name: 'chk_category_not_self_parent',
        test: (r) => !isSet(r.parent_category_id) || r.parent_category_id !== r.category_id,
        message: 'A category cannot be its own parent.',
      },
    ],
  },
  product: {
    name: 'product',
    label: 'Product',
    pk: ['product_id'],
    columns: [
      id('product_id'),
      fkCol('category_id', 'Category'),
      { name: 'sku', type: 'text', label: 'SKU', required: true, max: 30 },
      { name: 'name', type: 'text', label: 'Product name', required: true, max: 150 },
      { name: 'description', type: 'text', label: 'Description', max: 1000 },
      { name: 'color', type: 'text', label: 'Color', required: true, max: 50 },
      { name: 'size', type: 'text', label: 'Size', required: true, max: 20 },
      { name: 'price', type: 'money', label: 'Price', required: true, min: 0 },
      { name: 'compare_at_price', type: 'money', label: 'Compare-at price', min: 0 },
      { name: 'stock_qty', type: 'int', label: 'Stock', required: true, min: 0 },
      { name: 'image_url', type: 'text', label: 'Image' },
      { name: 'is_promo_eligible', type: 'bool', label: 'Promo eligible', required: true },
      { name: 'is_active', type: 'bool', label: 'Active', required: true },
    ],
    unique: [['sku']],
    fks: [{ columns: ['category_id'], refTable: 'category', refColumns: ['category_id'], onDelete: 'RESTRICT', nullable: false }],
    checks: [
      {
        name: 'chk_compare_at_price_gt_price',
        test: (r) => !isSet(r.compare_at_price) || Number(r.compare_at_price) > Number(r.price),
        message: 'Compare-at price must be higher than the price.',
      },
    ],
  },
  promo_code: {
    name: 'promo_code',
    label: 'PromoCode',
    pk: ['promo_code_id'],
    columns: [
      id('promo_code_id'),
      fkCol('membership_id', 'Owner (member)', false),
      { name: 'code', type: 'text', label: 'Code', required: true, max: 30, pattern: /^[A-Z0-9-]+$/, patternHint: 'capital letters, numbers and hyphens' },
      { name: 'discount_type', type: 'enum', label: 'Discount type', required: true, values: ENUMS.discount_type },
      { name: 'discount_value', type: 'money', label: 'Discount value', required: true, min: 0 },
      { name: 'max_discount', type: 'money', label: 'Max. discount', min: 0 },
      { name: 'min_purchase', type: 'money', label: 'Min. purchase', required: true, min: 0 },
      { name: 'starts_at', type: 'datetime', label: 'Starts', required: true },
      { name: 'ends_at', type: 'datetime', label: 'Ends', required: true },
      { name: 'usage_limit', type: 'int', label: 'Usage limit', min: 1 },
    ],
    unique: [['code']],
    fks: [{ columns: ['membership_id'], refTable: 'membership', refColumns: ['membership_id'], onDelete: 'CASCADE', nullable: true }],
    checks: [
      {
        name: 'chk_ends_after_starts',
        test: (r) => !isSet(r.starts_at) || !isSet(r.ends_at) || r.ends_at > r.starts_at,
        message: 'End time must be after the start time.',
      },
      {
        name: 'chk_percentage_le_100',
        test: (r) => r.discount_type !== 'percentage' || Number(r.discount_value) <= 100,
        message: 'A percentage discount cannot exceed 100.',
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
      fkCol('promo_code_id', 'Promo code', false),
      { name: 'order_number', type: 'text', label: 'Order number', required: true, max: 20 },
      { name: 'order_type', type: 'enum', label: 'Type', required: true, values: ENUMS.order_type },
      { name: 'status', type: 'enum', label: 'Status', required: true, values: ENUMS.order_status },
      { name: 'discount_amount', type: 'money', label: 'Discount', required: true, min: 0 },
      { name: 'shipping_cost', type: 'money', label: 'Shipping cost', required: true, min: 0 },
      { name: 'ordered_at', type: 'datetime', label: 'Ordered', required: true },
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
        message: 'Warranty replacement orders must be free and cannot use a promo code.',
      },
    ],
  },
  order_item: {
    name: 'order_item',
    label: 'OrderItem',
    pk: ['order_id', 'product_id'],
    columns: [
      fkCol('order_id', 'Order'),
      fkCol('product_id', 'Product'),
      { name: 'quantity', type: 'int', label: 'Qty', required: true, min: 1 },
      { name: 'unit_price', type: 'money', label: 'Unit price', required: true, min: 0 },
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
      fkCol('order_id', 'Order'),
      { name: 'method', type: 'enum', label: 'Method', required: true, values: ENUMS.payment_method },
      { name: 'amount', type: 'money', label: 'Amount', required: true, min: 0 },
      { name: 'status', type: 'enum', label: 'Status', required: true, values: ENUMS.payment_status },
      { name: 'reference_no', type: 'text', label: 'Reference number', required: true, max: 20 },
      { name: 'paid_at', type: 'datetime', label: 'Paid' },
    ],
    unique: [['order_id'], ['reference_no']],
    fks: [{ columns: ['order_id'], refTable: 'orders', refColumns: ['order_id'], onDelete: 'CASCADE', nullable: false }],
    checks: [
      {
        name: 'chk_paid_has_paid_at',
        test: (r) => r.status !== 'paid' || isSet(r.paid_at),
        message: 'A paid payment needs a payment time.',
      },
    ],
  },
  shipment: {
    name: 'shipment',
    label: 'Shipment',
    pk: ['shipment_id'],
    columns: [
      id('shipment_id'),
      fkCol('order_id', 'Order'),
      { name: 'shipping_service', type: 'enum', label: 'Service', required: true, values: ENUMS.shipping_service },
      { name: 'recipient_name', type: 'text', label: 'Recipient', required: true, max: 100 },
      { name: 'recipient_phone', type: 'text', label: 'Phone', required: true, max: 20, ...PHONE },
      { name: 'street_address', type: 'text', label: 'Address', required: true, max: 255 },
      { name: 'city', type: 'text', label: 'City', required: true, max: 50 },
      { name: 'province', type: 'text', label: 'Province', required: true, max: 50 },
      { name: 'postal_code', type: 'text', label: 'Postal code', required: true, exact: 5, ...POSTAL },
      { name: 'tracking_number', type: 'text', label: 'Tracking number', max: 20 },
      { name: 'status', type: 'enum', label: 'Status', required: true, values: ENUMS.shipment_status },
      { name: 'shipped_at', type: 'datetime', label: 'Shipped' },
      { name: 'delivered_at', type: 'datetime', label: 'Delivered' },
    ],
    unique: [['order_id']],
    fks: [{ columns: ['order_id'], refTable: 'orders', refColumns: ['order_id'], onDelete: 'CASCADE', nullable: false }],
    checks: [
      {
        name: 'chk_shipped_has_tracking',
        test: (r) => !['shipped', 'delivered'].includes(r.status) || isSet(r.tracking_number),
        message: 'A shipped package needs a tracking number.',
      },
      {
        name: 'chk_delivered_after_shipped',
        test: (r) => !isSet(r.delivered_at) || !isSet(r.shipped_at) || r.delivered_at >= r.shipped_at,
        message: 'Delivery time cannot be before the ship time.',
      },
    ],
  },
  review: {
    name: 'review',
    label: 'Review',
    pk: ['customer_id', 'product_id'],
    columns: [
      fkCol('customer_id', 'Customer'),
      fkCol('product_id', 'Product'),
      { name: 'rating', type: 'int', label: 'Rating', required: true, min: 1, maxValue: 5 },
      { name: 'title', type: 'text', label: 'Title', required: true, max: 100 },
      { name: 'comment', type: 'text', label: 'Comment', max: 1000 },
      { name: 'created_at', type: 'datetime', label: 'Created', required: true },
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
      fkCol('product_id', 'Product'),
      fkCol('order_id', 'Original order', false),
      fkCol('replacement_order_id', 'Replacement order', false),
      fkCol('store_id', 'Store', false),
      { name: 'claim_number', type: 'text', label: 'Claim number', required: true, max: 20 },
      { name: 'purchase_place', type: 'text', label: 'Place of purchase', required: true, max: 100 },
      { name: 'purchase_date', type: 'date', label: 'Purchase date' },
      { name: 'date_code', type: 'text', label: 'Date code', required: true, exact: 4, pattern: /^[0-9A-Z]{4}$/, patternHint: '4 characters' },
      { name: 'issue_description', type: 'text', label: 'Issue description', required: true, max: 1000 },
      { name: 'status', type: 'enum', label: 'Status', required: true, values: ENUMS.claim_status },
      { name: 'rejection_reason', type: 'text', label: 'Rejection reason', max: 255 },
      { name: 'photo_full_url', type: 'text', label: 'Full photo', required: true, max: 255 },
      { name: 'photo_bottom_url', type: 'text', label: 'Bottom photo', required: true, max: 255 },
      { name: 'photo_defect_url', type: 'text', label: 'Defect photo', required: true, max: 255 },
      { name: 'submitted_at', type: 'datetime', label: 'Submitted', required: true },
      { name: 'resolved_at', type: 'datetime', label: 'Resolved' },
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
        message: 'Claims for in-store purchases need a purchase date; online purchases need the original order.',
      },
      {
        name: 'chk_rejected_has_reason',
        test: (r) => r.status !== 'rejected' || isSet(r.rejection_reason),
        message: 'A rejected claim needs a rejection reason.',
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
      { name: 'store_name', type: 'text', label: 'Store name', required: true, max: 100 },
      { name: 'street_address', type: 'text', label: 'Address', required: true, max: 255 },
      { name: 'city', type: 'text', label: 'City', required: true, max: 50 },
      { name: 'province', type: 'text', label: 'Province', required: true, max: 50 },
      { name: 'postal_code', type: 'text', label: 'Postal code', required: true, exact: 5, ...POSTAL },
      { name: 'phone', type: 'text', label: 'Phone', required: true, max: 20, ...PHONE },
      { name: 'latitude', type: 'decimal', label: 'Latitude', required: true, min: -90, maxValue: 90 },
      { name: 'longitude', type: 'decimal', label: 'Longitude', required: true, min: -180, maxValue: 180 },
      { name: 'opening_hours', type: 'text', label: 'Opening hours', required: true, max: 255 },
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
  percentage: 'Percentage',
  fixed_amount: 'Fixed amount',
  regular: 'Regular',
  warranty_replacement: 'Warranty replacement',
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  bca_va: 'BCA Virtual Account',
  mandiri_va: 'Mandiri Virtual Account',
  gopay: 'GoPay',
  ovo: 'OVO',
  qris: 'QRIS',
  credit_card: 'Credit card',
  paid: 'Paid',
  failed: 'Failed',
  expired: 'Expired',
  jne_reg: 'JNE REG',
  jne_yes: 'JNE YES',
  sicepat_best: 'SiCepat BEST',
  gosend_same_day: 'GoSend Same Day',
  jt_ez: 'J&T EZ',
  awaiting_payment: 'Awaiting payment',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
};

/** Friendly plural nouns for "still used by N …" messages. */
export const NOUNS: Record<string, string> = {
  customer: 'customers',
  membership: 'memberships',
  customer_address: 'saved addresses',
  category: 'subcategories',
  product: 'products',
  promo_code: 'promo codes',
  orders: 'orders',
  order_item: 'order items',
  payment: 'payments',
  shipment: 'shipments',
  review: 'reviews',
  warranty_claim: 'warranty claims',
  store: 'stores',
};

export const SHIPPING_COST: Record<string, number> = {
  jne_reg: 18000,
  jne_yes: 32000,
  sicepat_best: 25000,
  gosend_same_day: 45000,
  jt_ez: 16000,
};
