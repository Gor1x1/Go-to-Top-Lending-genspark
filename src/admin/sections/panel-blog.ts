/**
 * Admin Panel — Blog management section
 * Handles blog posts, categories, cover images
 */
export const CODE: string = `
// ===== BLOG =====
var blogData = { posts: [], categories: [], editingPost: null, editingCategory: null, filterCategory: '', filterPublished: '' };

async function reloadBlogData() {
  var [posts, cats] = await Promise.all([
    api('/blog-posts'),
    api('/blog-categories')
  ]);
  blogData.posts = posts || [];
  blogData.categories = cats || [];
}

function renderBlog() {
  var h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px"><i class="fas fa-book-open" style="color:#8B5CF6;margin-right:10px"></i>Блог</h1>';
  h += '<p style="color:#94a3b8;margin-bottom:24px">Управление статьями блога. Каждая статья — отдельная страница на сайте.</p>';

  // Tabs: Posts | Categories
  var blogTab = (window._blogTab || 'posts');
  h += '<div style="display:flex;gap:8px;margin-bottom:24px">';
  h += '<button class="tab-btn ' + (blogTab==='posts'?'active':'') + '" onclick="window._blogTab=\\'posts\\';render()">Статьи (' + blogData.posts.length + ')</button>';
  h += '<button class="tab-btn ' + (blogTab==='categories'?'active':'') + '" onclick="window._blogTab=\\'categories\\';render()">Категории (' + blogData.categories.length + ')</button>';
  h += '</div>';

  if (blogTab === 'categories') {
    h += renderBlogCategories();
  } else {
    h += renderBlogPosts();
  }
  h += '</div>';
  document.getElementById('mainContent').innerHTML = h;
  initBlogSortable();
}

function renderBlogPosts() {
  var h = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center">';
  h += '<button class="btn btn-primary" onclick="openBlogPostEditor(null)"><i class="fas fa-plus" style="margin-right:6px"></i>Новая статья</button>';
  // Filter by category
  h += '<select class="input" style="width:180px;padding:8px 12px" onchange="blogData.filterCategory=this.value;render()">';
  h += '<option value="">Все категории</option>';
  for (var ci=0; ci<blogData.categories.length; ci++) {
    var cat = blogData.categories[ci];
    h += '<option value="' + cat.id + '" ' + (blogData.filterCategory==cat.id?'selected':'') + '>' + escHtml(cat.name_ru) + '</option>';
  }
  h += '</select>';
  // Filter published
  h += '<select class="input" style="width:150px;padding:8px 12px" onchange="blogData.filterPublished=this.value;render()">';
  h += '<option value="">Все статусы</option>';
  h += '<option value="1" ' + (blogData.filterPublished==='1'?'selected':'') + '>Опубликованные</option>';
  h += '<option value="0" ' + (blogData.filterPublished==='0'?'selected':'') + '>Черновики</option>';
  h += '</select>';
  h += '</div>';

  // Posts list
  var posts = blogData.posts.filter(function(p) {
    if (blogData.filterCategory && String(p.category_id) !== String(blogData.filterCategory)) return false;
    if (blogData.filterPublished !== '' && String(p.published) !== blogData.filterPublished) return false;
    return true;
  });

  if (!posts.length) {
    h += '<div class="card" style="text-align:center;padding:40px;color:#64748b"><i class="fas fa-book-open" style="font-size:2rem;margin-bottom:12px;display:block"></i>Нет статей. Создайте первую!</div>';
    return h;
  }

  h += '<div id="blogPostsList">';
  for (var i=0; i<posts.length; i++) {
    var post = posts[i];
    var catName = '';
    for (var ci2=0; ci2<blogData.categories.length; ci2++) {
      if (blogData.categories[ci2].id == post.category_id) { catName = blogData.categories[ci2].name_ru; break; }
    }
    var isPublished = post.published == 1;
    h += '<div class="card blog-post-item" data-id="' + post.id + '" style="margin-bottom:12px;display:flex;gap:16px;align-items:flex-start;padding:16px">';
    // Drag handle
    h += '<div class="sb-drag-handle blog-drag-handle" title="Перетащить"><i class="fas fa-grip-vertical"></i></div>';
    // Cover thumbnail
    if (post.cover_url) {
      h += '<img src="' + escHtml(post.cover_url) + '" style="width:80px;height:60px;object-fit:cover;border-radius:8px;flex-shrink:0" onerror="this.style.display=\\'none\\'">';
    } else {
      h += '<div style="width:80px;height:60px;background:#1e293b;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-image" style="color:#475569"></i></div>';
    }
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">';
    h += '<span style="font-weight:700;font-size:1rem">' + escHtml(post.title_ru || 'Без заголовка') + '</span>';
    h += '<span class="badge ' + (isPublished ? 'badge-green' : 'badge-amber') + '">' + (isPublished ? 'Опубликовано' : 'Черновик') + '</span>';
    if (catName) h += '<span class="badge badge-purple">' + escHtml(catName) + '</span>';
    h += '</div>';
    // Slug
    h += '<div style="font-size:0.8rem;color:#64748b;margin-bottom:6px">/blog/' + escHtml(post.slug) + '</div>';
    // Preview of body
    var bodyPreview = (post.body_ru || '').replace(/<[^>]+>/g, '').substring(0, 100);
    if (bodyPreview) h += '<div style="font-size:0.82rem;color:#94a3b8">' + escHtml(bodyPreview) + (post.body_ru && post.body_ru.length > 100 ? '...' : '') + '</div>';
    h += '</div>';
    // Actions
    h += '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">';
    h += '<button class="btn btn-outline" style="padding:6px 12px;font-size:0.8rem" onclick="openBlogPostEditor(' + post.id + ')"><i class="fas fa-edit"></i></button>';
    h += '<button class="btn ' + (isPublished?'btn-success':'btn-outline') + '" style="padding:6px 12px;font-size:0.8rem" onclick="toggleBlogPublish(' + post.id + ',' + (isPublished?0:1) + ')" title="' + (isPublished?'Снять публикацию':'Опубликовать') + '"><i class="fas fa-' + (isPublished?'eye-slash':'eye') + '"></i></button>';
    h += '<a href="/blog/' + escHtml(post.slug) + '" target="_blank" class="btn btn-outline" style="padding:6px 12px;font-size:0.8rem;text-decoration:none" title="Открыть на сайте"><i class="fas fa-external-link-alt"></i></a>';
    h += '<button class="btn btn-danger" style="padding:6px 12px;font-size:0.8rem" onclick="deleteBlogPost(' + post.id + ')"><i class="fas fa-trash"></i></button>';
    h += '</div>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function renderBlogCategories() {
  var h = '<div style="margin-bottom:16px"><button class="btn btn-primary" onclick="openBlogCategoryEditor(null)"><i class="fas fa-plus" style="margin-right:6px"></i>Новая категория</button></div>';
  if (!blogData.categories.length) {
    h += '<div class="card" style="text-align:center;padding:40px;color:#64748b">Нет категорий.</div>';
    return h;
  }
  h += '<div class="card" style="overflow:hidden;padding:0"><table style="width:100%;border-collapse:collapse">';
  h += '<thead><tr style="background:#0f172a"><th style="padding:12px 16px;text-align:left;font-size:0.8rem;color:#64748b">Название RU</th><th style="padding:12px 16px;text-align:left;font-size:0.8rem;color:#64748b">AM</th><th style="padding:12px 16px;text-align:left;font-size:0.8rem;color:#64748b">Slug</th><th style="padding:12px 16px;text-align:left;font-size:0.8rem;color:#64748b">Порядок</th><th style="padding:12px 16px"></th></tr></thead><tbody>';
  for (var i=0; i<blogData.categories.length; i++) {
    var cat = blogData.categories[i];
    h += '<tr style="border-top:1px solid #334155">';
    h += '<td style="padding:12px 16px;font-weight:600">' + escHtml(cat.name_ru) + '</td>';
    h += '<td style="padding:12px 16px;color:#94a3b8">' + escHtml(cat.name_am || '') + '</td>';
    h += '<td style="padding:12px 16px;font-family:monospace;font-size:0.8rem;color:#8B5CF6">' + escHtml(cat.slug) + '</td>';
    h += '<td style="padding:12px 16px;color:#64748b">' + (cat.sort_order || 0) + '</td>';
    h += '<td style="padding:12px 16px;text-align:right;white-space:nowrap">';
    h += '<button class="btn btn-outline" style="padding:6px 12px;font-size:0.8rem;margin-right:6px" onclick="openBlogCategoryEditor(' + cat.id + ')"><i class="fas fa-edit"></i></button>';
    h += '<button class="btn btn-danger" style="padding:6px 12px;font-size:0.8rem" onclick="deleteBlogCategory(' + cat.id + ')"><i class="fas fa-trash"></i></button>';
    h += '</td></tr>';
  }
  h += '</tbody></table></div>';
  return h;
}

function initBlogSortable() {
  var el = document.getElementById('blogPostsList');
  if (!el || typeof Sortable === 'undefined') return;
  Sortable.create(el, {
    handle: '.blog-drag-handle',
    animation: 150,
    onEnd: async function(evt) {
      var items = el.querySelectorAll('.blog-post-item');
      var order = [];
      for (var i=0; i<items.length; i++) {
        order.push({ id: parseInt(items[i].dataset.id), sort_order: i });
      }
      await api('/blog-posts/reorder', 'POST', { order: order });
      await reloadBlogData();
    }
  });
}

function openBlogPostEditor(postId) {
  var post = postId ? blogData.posts.find(function(p){return p.id==postId;}) : null;
  var catsOptions = '<option value="">Без категории</option>';
  for (var i=0; i<blogData.categories.length; i++) {
    var c = blogData.categories[i];
    catsOptions += '<option value="' + c.id + '" ' + (post && post.category_id==c.id?'selected':'') + '>' + escHtml(c.name_ru) + '</option>';
  }

  var modal = '<div id="blogPostModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)closeBlogPostModal()">';
  modal += '<div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px;width:100%;max-width:800px;max-height:90vh;overflow-y:auto">';
  modal += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">';
  modal += '<h2 style="font-size:1.4rem;font-weight:800">' + (post ? 'Редактировать статью' : 'Новая статья') + '</h2>';
  modal += '<button onclick="closeBlogPostModal()" style="background:none;border:none;color:#64748b;font-size:1.5rem;cursor:pointer">&times;</button>';
  modal += '</div>';

  modal += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
  // Slug
  modal += '<div class="sb-field-group" style="grid-column:1/-1"><label style="font-size:0.78rem;font-weight:700;color:#64748b;display:block;margin-bottom:6px">SLUG (URL) — только латиница, цифры, дефис</label>';
  modal += '<input class="input" id="bpSlug" type="text" value="' + escHtml(post?.slug || '') + '" placeholder="kak-vyjti-v-top-wildberries"></div>';
  // Title RU
  modal += '<div class="sb-field-group"><label class="sb-field-label ru"><i class="fas fa-circle" style="font-size:6px;color:#8B5CF6"></i>Заголовок RU</label>';
  modal += '<input class="input" id="bpTitleRu" type="text" value="' + escHtml(post?.title_ru || '') + '"></div>';
  // Title AM
  modal += '<div class="sb-field-group"><label class="sb-field-label am"><i class="fas fa-circle" style="font-size:6px;color:#F59E0B"></i>Заголовок AM</label>';
  modal += '<input class="input" id="bpTitleAm" type="text" value="' + escHtml(post?.title_am || '') + '"></div>';
  modal += '</div>';

  // Cover image
  modal += '<div class="sb-field-group" style="margin-top:16px"><label style="font-size:0.78rem;font-weight:700;color:#64748b;display:block;margin-bottom:6px">ОБЛОЖКА СТАТЬИ</label>';
  modal += '<div style="display:flex;gap:10px;align-items:flex-start">';
  if (post?.cover_url) {
    modal += '<img id="bpCoverPreview" src="' + escHtml(post.cover_url) + '" style="width:120px;height:80px;object-fit:cover;border-radius:8px;border:1px solid #334155" onerror="this.style.display=\\'none\\'">';
  } else {
    modal += '<div id="bpCoverPreview" style="width:120px;height:80px;background:#0f172a;border-radius:8px;border:1px solid #334155;display:flex;align-items:center;justify-content:center;color:#475569"><i class="fas fa-image"></i></div>';
  }
  modal += '<div>';
  modal += '<input type="file" id="bpCoverFile" accept="image/*" style="display:none" onchange="uploadBlogCover(this)">';
  modal += '<button class="btn btn-outline" style="margin-bottom:8px;display:block" onclick="document.getElementById(\\'bpCoverFile\\').click()"><i class="fas fa-upload" style="margin-right:6px"></i>Загрузить фото</button>';
  modal += '<input class="input" id="bpCoverUrl" type="text" value="' + escHtml(post?.cover_url || '') + '" placeholder="Или вставьте URL фото" oninput="updateBlogCoverPreview(this.value)" style="font-size:0.8rem">';
  modal += '</div></div></div>';

  // Body RU
  modal += '<div class="sb-field-group" style="margin-top:16px"><label class="sb-field-label ru"><i class="fas fa-circle" style="font-size:6px;color:#8B5CF6"></i>Текст статьи RU (HTML поддерживается)</label>';
  modal += '<textarea class="input" id="bpBodyRu" style="min-height:200px;font-family:monospace;font-size:0.85rem">' + escHtml(post?.body_ru || '') + '</textarea></div>';
  // Body AM
  modal += '<div class="sb-field-group"><label class="sb-field-label am"><i class="fas fa-circle" style="font-size:6px;color:#F59E0B"></i>Текст статьи AM</label>';
  modal += '<textarea class="input" id="bpBodyAm" style="min-height:120px;font-family:monospace;font-size:0.85rem">' + escHtml(post?.body_am || '') + '</textarea></div>';

  // Category + sort
  modal += '<div style="display:grid;grid-template-columns:1fr 1fr 120px;gap:16px;margin-top:16px">';
  modal += '<div><label style="font-size:0.78rem;font-weight:700;color:#64748b;display:block;margin-bottom:6px">КАТЕГОРИЯ</label>';
  modal += '<select class="input" id="bpCategory">' + catsOptions + '</select></div>';
  modal += '<div><label style="font-size:0.78rem;font-weight:700;color:#64748b;display:block;margin-bottom:6px">СТАТУС</label>';
  modal += '<select class="input" id="bpPublished">';
  modal += '<option value="0" ' + (post && !post.published?'selected':'') + '>Черновик</option>';
  modal += '<option value="1" ' + (post && post.published?'selected':'') + '>Опубликовано</option>';
  modal += '</select></div>';
  modal += '<div><label style="font-size:0.78rem;font-weight:700;color:#64748b;display:block;margin-bottom:6px">ПОРЯДОК</label>';
  modal += '<input class="input" id="bpSortOrder" type="number" value="' + (post?.sort_order || 0) + '"></div>';
  modal += '</div>';

  // Buttons
  modal += '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:24px">';
  modal += '<button class="btn btn-outline" onclick="closeBlogPostModal()">Отмена</button>';
  modal += '<button class="btn btn-primary" onclick="saveBlogPost(' + (post ? post.id : 'null') + ')"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить</button>';
  modal += '</div>';
  modal += '</div></div>';

  document.body.insertAdjacentHTML('beforeend', modal);
}

function closeBlogPostModal() {
  var m = document.getElementById('blogPostModal');
  if (m) m.remove();
}

async function uploadBlogCover(input) {
  if (!input.files || !input.files[0]) return;
  var formData = new FormData();
  formData.append('file', input.files[0]);
  try {
    var resp = await fetch('/api/admin/upload-image', { method: 'POST', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('gtt_token') }, body: formData });
    var data = await resp.json();
    if (data.url) {
      document.getElementById('bpCoverUrl').value = data.url;
      updateBlogCoverPreview(data.url);
      showToast('Фото загружено', 'success');
    }
  } catch(e) { showToast('Ошибка загрузки', 'error'); }
}

function updateBlogCoverPreview(url) {
  var preview = document.getElementById('bpCoverPreview');
  if (!preview) return;
  if (url) {
    preview.outerHTML = '<img id="bpCoverPreview" src="' + escHtml(url) + '" style="width:120px;height:80px;object-fit:cover;border-radius:8px;border:1px solid #334155" onerror="this.style.display=\\'none\\'">';
  }
}

async function saveBlogPost(postId) {
  var slug = document.getElementById('bpSlug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  var titleRu = document.getElementById('bpTitleRu').value.trim();
  if (!slug) { showToast('Введите slug', 'error'); return; }
  if (!titleRu) { showToast('Введите заголовок на русском', 'error'); return; }

  var payload = {
    slug: slug,
    title_ru: titleRu,
    title_am: document.getElementById('bpTitleAm').value.trim(),
    body_ru: document.getElementById('bpBodyRu').value,
    body_am: document.getElementById('bpBodyAm').value,
    cover_url: document.getElementById('bpCoverUrl').value.trim(),
    category_id: document.getElementById('bpCategory').value || null,
    published: parseInt(document.getElementById('bpPublished').value),
    sort_order: parseInt(document.getElementById('bpSortOrder').value) || 0
  };

  try {
    if (postId) {
      await api('/blog-posts/' + postId, 'PUT', payload);
    } else {
      await api('/blog-posts', 'POST', payload);
    }
    closeBlogPostModal();
    await reloadBlogData();
    render();
    showToast('Статья сохранена', 'success');
  } catch(e) { showToast('Ошибка сохранения', 'error'); }
}

async function toggleBlogPublish(postId, publishedVal) {
  await api('/blog-posts/' + postId + '/publish', 'POST', { published: publishedVal });
  await reloadBlogData();
  render();
  showToast(publishedVal ? 'Статья опубликована' : 'Статья снята с публикации', 'success');
}

async function deleteBlogPost(postId) {
  if (!confirm('Удалить статью? Это действие нельзя отменить.')) return;
  await api('/blog-posts/' + postId, 'DELETE');
  await reloadBlogData();
  render();
  showToast('Статья удалена', 'success');
}

function openBlogCategoryEditor(catId) {
  var cat = catId ? blogData.categories.find(function(c){return c.id==catId;}) : null;
  var modal = '<div id="blogCatModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)closeBlogCatModal()">';
  modal += '<div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px;width:100%;max-width:500px">';
  modal += '<h2 style="font-size:1.3rem;font-weight:800;margin-bottom:20px">' + (cat ? 'Редактировать категорию' : 'Новая категория') + '</h2>';
  modal += '<div class="sb-field-group"><label style="font-size:0.78rem;font-weight:700;color:#64748b;display:block;margin-bottom:6px">SLUG</label>';
  modal += '<input class="input" id="bcSlug" type="text" value="' + escHtml(cat?.slug || '') + '" placeholder="buyouts"></div>';
  modal += '<div class="sb-field-group" style="margin-top:12px"><label class="sb-field-label ru"><i class="fas fa-circle" style="font-size:6px;color:#8B5CF6"></i>Название RU</label>';
  modal += '<input class="input" id="bcNameRu" type="text" value="' + escHtml(cat?.name_ru || '') + '" placeholder="Выкупы"></div>';
  modal += '<div class="sb-field-group" style="margin-top:12px"><label class="sb-field-label am"><i class="fas fa-circle" style="font-size:6px;color:#F59E0B"></i>Название AM</label>';
  modal += '<input class="input" id="bcNameAm" type="text" value="' + escHtml(cat?.name_am || '') + '"></div>';
  modal += '<div class="sb-field-group" style="margin-top:12px"><label style="font-size:0.78rem;font-weight:700;color:#64748b;display:block;margin-bottom:6px">ПОРЯДОК</label>';
  modal += '<input class="input" id="bcSort" type="number" value="' + (cat?.sort_order || 0) + '"></div>';
  modal += '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">';
  modal += '<button class="btn btn-outline" onclick="closeBlogCatModal()">Отмена</button>';
  modal += '<button class="btn btn-primary" onclick="saveBlogCategory(' + (cat?cat.id:'null') + ')">Сохранить</button>';
  modal += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', modal);
}

function closeBlogCatModal() { var m = document.getElementById('blogCatModal'); if(m) m.remove(); }

async function saveBlogCategory(catId) {
  var slug = document.getElementById('bcSlug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  var nameRu = document.getElementById('bcNameRu').value.trim();
  if (!slug || !nameRu) { showToast('Заполните обязательные поля', 'error'); return; }
  var payload = { slug, name_ru: nameRu, name_am: document.getElementById('bcNameAm').value.trim(), sort_order: parseInt(document.getElementById('bcSort').value)||0 };
  if (catId) {
    await api('/blog-categories/' + catId, 'PUT', payload);
  } else {
    await api('/blog-categories', 'POST', payload);
  }
  closeBlogCatModal();
  await reloadBlogData();
  render();
  showToast('Категория сохранена', 'success');
}

async function deleteBlogCategory(catId) {
  if (!confirm('Удалить категорию? Статьи в ней останутся, но потеряют категорию.')) return;
  await api('/blog-categories/' + catId, 'DELETE');
  await reloadBlogData();
  render();
  showToast('Категория удалена', 'success');
}
`;
