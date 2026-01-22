-- Actualizar fotos existentes sin bucket
UPDATE booking_media
SET bucket = 'booking-proof-private'
WHERE bucket IS NULL OR bucket = '';

-- Verificar que se actualizaron
SELECT COUNT(*) as total_fixed
FROM booking_media
WHERE bucket = 'booking-proof-private';
