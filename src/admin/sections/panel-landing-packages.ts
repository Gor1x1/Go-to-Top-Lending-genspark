/**
 * Admin Panel — Landing Packages section (mirror)
 *
 * The "Пакеты лендинга" admin section: CRUD for the new `landing_packages`
 * table that powers 3 marketing tiles on /home and detail pages /package/:slug.
 * NOT to be confused with calculator_packages (calculator bundles).
 *
 * NOTE: This file is a reference mirror for future refactoring.
 * The active implementation lives inline in `src/admin/panel.ts`
 * (because the admin app currently bundles all sections into a single
 * IIFE — see `frontend-implementer.md` for the architectural note).
 *
 * Image uploads reuse the shared `/api/admin/upload-image` endpoint
 * (R2-backed) — same path used by blog covers and site_blocks photos.
 */
export const CODE: string = `
// ===== LANDING PACKAGES (Phase 3) =====
var landingPackagesData = { items: [], editing: null };

async function reloadLandingPackagesData() {
  try {
    var rows = await api('/landing-packages');
    landingPackagesData.items = Array.isArray(rows) ? rows : [];
  } catch(e) {
    landingPackagesData.items = [];
  }
}

function renderLandingPackages() {
  var h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px"><i class="fas fa-cube" style="color:#8B5CF6;margin-right:10px"></i>Пакеты лендинга</h1>';
  h += '<p style="color:#94a3b8;margin-bottom:24px">3 маркетинговых пакета на главной странице /home с детальными страницами /package/:slug.</p>';
  h += '<div style="margin-bottom:20px"><button class="btn btn-primary" onclick="openLandingPackageEditor(null)"><i class="fas fa-plus" style="margin-right:6px"></i>Новый пакет</button></div>';

  var items = landingPackagesData.items || [];
  if (!items.length) {
    h += '<div class="card" style="text-align:center;padding:40px;color:#64748b">Нет пакетов. Создайте первый!</div></div>';
    return h;
  }

  h += '<div id="landingPackagesList">';
  for (var i = 0; i < items.length; i++) {
    var p = items[i];
    var isVisible = p.is_visible == 1;
    h += '<div class="card landing-pkg-item" data-id="' + p.id + '" style="margin-bottom:12px;display:flex;gap:16px;align-items:flex-start;padding:16px">';
    h += '<div class="sb-drag-handle landing-pkg-drag" title="Перетащить"><i class="fas fa-grip-vertical"></i></div>';
    if (p.cover_url) {
      h += '<img src="' + escHtml(p.cover_url) + '" style="width:96px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0">';
    } else {
      h += '<div style="width:96px;height:64px;background:#1e293b;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-image" style="color:#475569"></i></div>';
    }
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-weight:700;font-size:1rem;margin-bottom:6px">' + escHtml(p.title_ru || 'Без заголовка') + (isVisible ? '' : ' <span class="badge badge-amber">Скрыт</span>') + '</div>';
    h += '<div style="font-size:0.8rem;color:#64748b;margin-bottom:6px;font-family:monospace">/package/' + escHtml(p.slug) + '</div>';
    h += '</div>';
    h += '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">';
    h += '<button class="btn btn-outline" onclick="openLandingPackageEditor(' + p.id + ')"><i class="fas fa-edit"></i></button>';
    h += '<button class="btn btn-danger" onclick="deleteLandingPackage(' + p.id + ')"><i class="fas fa-trash"></i></button>';
    h += '</div>';
    h += '</div>';
  }
  h += '</div></div>';
  return h;
}

// See src/admin/panel.ts for the full implementation:
//  - openLandingPackageEditor (modal with photo upload + bilingual fields)
//  - saveLandingPackage / deleteLandingPackage / toggleLandingPackageVisibility
//  - initLandingPackagesSortable (drag-and-drop reorder)
//  - uploadLandingPackageCover (uses /api/admin/upload-image → R2)
`;
