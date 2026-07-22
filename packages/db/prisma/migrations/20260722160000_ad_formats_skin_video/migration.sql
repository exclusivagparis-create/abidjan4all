-- Nouveaux formats publicitaires : habillage (fond de page) et vidéo.
ALTER TYPE "AdFormat" ADD VALUE IF NOT EXISTS 'skin';
ALTER TYPE "AdFormat" ADD VALUE IF NOT EXISTS 'video';
