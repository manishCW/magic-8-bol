SELECT
    t.id AS order_internal_id,
    t.tranid AS order_number,
    t.type AS order_type,
    BUILTIN.DF(t.status) AS order_status,
    tl.id AS line_id,
    tl.item AS item_internal_id,
    BUILTIN.DF(tl.item) AS item_name,
    tl.location AS line_location_internal_id,
    BUILTIN.DF(tl.location) AS line_location_name,
    tl.units AS unit_internal_id,
    BUILTIN.DF(tl.units) AS unit_of_measure,
    TO_CHAR(
        CASE
            WHEN t.type = 'PurchOrd'
                THEN tl.custcol_cw_requested_receipt_date
            WHEN t.type = 'TrnfrOrd'
                THEN tl.expectedReceiptDate
        END,
        'YYYY-MM-DD'
    ) AS planning_receipt_date,
    tl.isclosed AS line_closed,
    tl.quantity AS raw_quantity,
    NVL(tl.quantityshiprecv, 0)
        AS raw_shipped_received_quantity,
    tl.quantity - NVL(tl.quantityshiprecv, 0)
        AS outstanding_quantity
FROM
    transaction t
INNER JOIN
    transactionline tl
    ON tl.transaction = t.id
WHERE
    t.type IN ('PurchOrd', 'TrnfrOrd')
    AND tl.mainline = 'F'
    AND tl.taxline = 'F'
    AND tl.item IS NOT NULL
    AND tl.isclosed = 'F'
    AND tl.quantity > 0
    AND tl.quantity - NVL(tl.quantityshiprecv, 0) > 0
ORDER BY
    t.id ASC,
    tl.id ASC