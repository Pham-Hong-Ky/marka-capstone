-- Default credit top-up packages (one-time, no expiry)
INSERT INTO "credit_packages" (
  "id",
  "name",
  "description",
  "creditAmount",
  "price",
  "sortOrder",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    'Nạp 500',
    'Dùng cho trợ lý AI và sinh ảnh',
    500,
    25000,
    1,
    true,
    NOW(),
    NOW()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Nạp 1.500',
    'Dùng cho trợ lý AI và sinh ảnh',
    1500,
    69000,
    2,
    true,
    NOW(),
    NOW()
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'Nạp 5.000',
    'Dùng cho trợ lý AI và sinh ảnh',
    5000,
    199000,
    3,
    true,
    NOW(),
    NOW()
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'Nạp 10.000',
    'Dùng cho trợ lý AI và sinh ảnh',
    10000,
    349000,
    4,
    true,
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "creditAmount" = EXCLUDED."creditAmount",
  "price" = EXCLUDED."price",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = NOW();
