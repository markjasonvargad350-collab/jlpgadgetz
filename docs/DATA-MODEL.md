# Data Model — iStore

The database is PostgreSQL, modeled with Prisma ([`server/prisma/schema.prisma`](../server/prisma/schema.prisma)).
A generated SQL snapshot lives in [`generated-schema.sql`](./generated-schema.sql) (for reviewers without a DB).

**14 entities · 8 enums · 13 foreign keys · 38 indexes.**

## Guiding principles

1. **Admin-only accounts.** Only staff have `User` rows. Shoppers check out as **guests** — their details are captured inline on the `Order`. There is no customer login anywhere in the system.
2. **Money is `DECIMAL(12,2)`**, never a float — no rounding drift on prices or totals.
3. **Stock never changes without a ledger entry.** Every mutation of `ProductVariant.stock` is paired with an `InventoryTransaction` (RESTOCK / SALE / RETURN / ADJUSTMENT / CANCELLATION). The opening balance is itself a RESTOCK row.
4. **Orders snapshot their line items.** `OrderItem` copies `productName`, `variantLabel`, `sku`, and `unitPrice` at purchase time, so order history is immutable even if the catalog changes later.
5. **History outlives the catalog.** Variants with sales/inventory history can't be hard-deleted (`onDelete: Restrict`); the app archives via `isActive` / `status` instead. `OrderItem.variantId` is nullable + `SetNull` so an order survives if a variant is ever removed.
6. **Overselling is impossible under concurrency.** Order creation + stock deduction happen inside one `prisma.$transaction` that re-reads stock and rejects if `stock < quantity` (implemented with the order service in a later phase).

## ER diagram

```mermaid
erDiagram
    Role ||--o{ User : "employs"
    User ||--o{ InventoryTransaction : "records (admin)"
    User ||--o{ AuditLog : "acts"

    Category ||--o{ Product : "groups"
    Product ||--o{ ProductImage : "has"
    Product ||--o{ ProductVariant : "has"

    ProductVariant ||--o{ OrderItem : "sold as"
    ProductVariant ||--o{ InventoryTransaction : "ledger"

    Order ||--o{ OrderItem : "contains"
    Order ||--o| Payment : "paid by"
    Order ||--o| Shipment : "fulfilled by"
    Order ||--o{ InventoryTransaction : "causes"

    Shipment ||--o{ TrackingHistory : "logs"

    Role {
        string id PK
        string name UK
        string description
    }
    User {
        string id PK
        string email UK
        string passwordHash
        string name
        boolean isActive
        datetime lastLoginAt
        string roleId FK
    }
    Category {
        string id PK
        string slug UK
        string name
        int position
        boolean isActive
    }
    Product {
        string id PK
        string slug UK
        string name
        string brand
        string model
        string description
        string_arr highlights
        decimal basePrice
        int discountPct
        enum status
        boolean isFeatured
        boolean isNewArrival
        boolean isBestSeller
        boolean isDeal
        int releaseYear
        string categoryId FK
    }
    ProductImage {
        string id PK
        string url
        string alt
        int position
        string productId FK
    }
    ProductVariant {
        string id PK
        string sku UK
        string storage
        string color
        string colorHex
        decimal price
        int stock
        int reservedStock
        int soldQty
        int lowStockThreshold
        boolean isActive
        string productId FK
    }
    Order {
        string id PK
        string orderNumber UK
        string customerName
        string customerEmail
        string customerPhone
        string addressLine
        string barangay
        string city
        string province
        string postalCode
        decimal subtotal
        decimal deliveryFee
        decimal discount
        decimal total
        enum paymentMethod
        enum paymentStatus
        enum status
    }
    OrderItem {
        string id PK
        string orderId FK
        string variantId FK "nullable"
        string productName
        string variantLabel
        string sku
        decimal unitPrice
        int quantity
        decimal lineTotal
    }
    Payment {
        string id PK
        string orderId FK,UK
        enum method
        enum status
        decimal amount
        string reference
        datetime paidAt
    }
    Shipment {
        string id PK
        string orderId FK,UK
        enum status
        string courier
        string trackingCode
        float originLat
        float originLng
        float destLat
        float destLng
        float currentLat
        float currentLng
        datetime estimatedArrival
        datetime deliveredAt
    }
    TrackingHistory {
        string id PK
        string shipmentId FK
        enum status
        string note
        float lat
        float lng
        datetime createdAt
    }
    InventoryTransaction {
        string id PK
        string variantId FK
        enum type
        int previousStock
        int quantityChanged
        int newStock
        string reason
        string orderId FK "nullable"
        string adminId FK "nullable"
    }
    Notification {
        string id PK
        enum type
        enum level
        string title
        string message
        boolean isRead
        string entityType
        string entityId
    }
    AuditLog {
        string id PK
        string adminId FK "nullable"
        string action
        string entityType
        string entityId
        json meta
        string ip
    }
```

## Enums

| Enum | Values |
|------|--------|
| `ProductStatus` | DRAFT · ACTIVE · ARCHIVED |
| `OrderStatus` | RECEIVED · PROCESSING · PACKED · SHIPPED · IN_TRANSIT · OUT_FOR_DELIVERY · DELIVERED · CANCELLED |
| `PaymentMethod` | COD · GCASH · BANK_TRANSFER |
| `PaymentStatus` | PENDING · PAID · FAILED · REFUNDED |
| `ShipmentStatus` | PENDING · PREPARING · IN_TRANSIT · OUT_FOR_DELIVERY · DELIVERED · FAILED |
| `InventoryTxnType` | RESTOCK · SALE · RETURN · ADJUSTMENT · CANCELLATION |
| `NotificationType` | NEW_ORDER · LOW_STOCK · OUT_OF_STOCK · PAYMENT · SYSTEM |
| `NotificationLevel` | INFO · SUCCESS · WARNING · ERROR |

## Referential actions (deletes)

| Relation | Action | Rationale |
|----------|--------|-----------|
| `User.role` → Role | Restrict | Can't delete a role that's still assigned. |
| `Product.category` → Category | Restrict | Can't delete a category with products. |
| `ProductImage.product` → Product | Cascade | Images are owned by the product. |
| `ProductVariant.product` → Product | Cascade | Variants are owned by the product… |
| `InventoryTransaction.variant` → ProductVariant | **Restrict** | …but a variant with a ledger can't be deleted, which transitively protects sold products (archive instead). |
| `OrderItem.order` → Order | Cascade | Items belong to the order. |
| `OrderItem.variant` → ProductVariant | SetNull | Order history survives variant removal (details are snapshotted). |
| `Payment.order` / `Shipment.order` → Order | Cascade | 1:1 children of the order. |
| `TrackingHistory.shipment` → Shipment | Cascade | Events belong to the shipment. |
| `InventoryTransaction.order` → Order | SetNull | Keep the ledger even if an order is purged. |
| `InventoryTransaction.admin` / `AuditLog.admin` → User | SetNull | Keep the audit trail even if an admin is removed. |

## Simulated delivery (not real GPS)

`Shipment` and `TrackingHistory` carry `lat`/`lng` for the Leaflet/OpenStreetMap tracking map. These are **simulated** waypoints (Warehouse → Distribution Hub → In Transit → Out for Delivery → Delivered), clearly labeled as such in the UI. The model is shaped so a real courier API can later populate `currentLat`/`currentLng` without schema changes.
