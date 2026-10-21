const gallery = document.querySelector('#gallery');
const viewer = document.querySelector('#viewer');
const stage = document.querySelector('#image-stage');
const viewerImage = document.querySelector('#viewer-image');
const filters = [...document.querySelectorAll('[data-filter]')];
let images = [], visible = [], current = 0, returnFocus = null, startTouch = null, activeFilter = '全部';

function imageUrl(path) { return new URL(path, document.baseURI).href; }
function resetZoom() {
  stage.classList.remove('zoomed');
  document.querySelector('#zoom').setAttribute('aria-pressed', 'false');
  document.querySelector('#zoom').textContent = '放大细看';
  stage.scrollTop = stage.scrollLeft = 0;
}
function showImage(index, updateHash = true) {
  current = (index + visible.length) % visible.length;
  const item = visible[current];
  resetZoom();
  viewerImage.src = imageUrl(item.image);
  viewerImage.alt = item.title + '，装修风格效果图';
  document.querySelector('#viewer-title').textContent = item.title;
  document.querySelector('#viewer-description').textContent = (item.edition ? item.edition + (item.concept ? ' · 布局构思：' : ' · ') : '') + item.description;
  document.querySelector('#viewer-count').textContent = String(current + 1).padStart(2, '0') + ' / ' + String(visible.length).padStart(2, '0');
  const download = document.querySelector('#download');
  download.href = imageUrl(item.original);
  download.download = 'MuKo-Home-' + item.id + '.png';
  if (updateHash) history.replaceState(null, '', '#' + item.id);
}
function openImage(id, trigger) {
  const index = visible.findIndex(item => item.id === id);
  if (index < 0) return;
  returnFocus = trigger;
  showImage(index);
  viewer.showModal();
  document.body.style.overflow = 'hidden';
  document.querySelector('#close').focus();
}
function closeImage() { viewer.close(); }
function applyFilter(value, announce = true) {
  activeFilter = value;
  visible = images.filter(item => value === '全部' || (value === '第二辑' ? item.edition === '第二辑' : item.category === value));
  for (const button of filters) button.setAttribute('aria-pressed', String(button.dataset.filter === value));
  for (const card of gallery.children) card.hidden = !visible.some(item => item.id === card.dataset.id);
  if (announce) document.querySelector('#status').textContent = value + '，共 ' + visible.length + ' 张图片';
}
function createCard(item, index) {
  const card = document.createElement('article');
  card.className = 'card' + (index === 0 ? ' featured' : '');
  card.dataset.id = item.id;
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'image-button';
  button.setAttribute('aria-label', '放大查看：' + item.title);
  const image = document.createElement('img');
  image.src = imageUrl('images/' + item.id + '-960.webp'); image.srcset = item.srcset;
  image.sizes = index === 0 ? '92vw' : '(max-width: 700px) 90vw, 46vw';
  image.width = item.width; image.height = item.height; image.alt = item.title;
  image.loading = index === 0 ? 'eager' : 'lazy'; image.decoding = 'async';
  if (index === 0) image.fetchPriority = 'high';
  button.append(image); button.addEventListener('click', () => openImage(item.id, button));
  const caption = document.createElement('div'); caption.className = 'card-caption';
  const copy = document.createElement('div'); const title = document.createElement('h2');
  title.className = 'card-title'; title.textContent = item.title;
  const description = document.createElement('p'); description.className = 'card-description'; description.textContent = item.description;
  copy.append(title);
  if (item.edition) {
    const badge = document.createElement('span'); badge.className = 'edition-badge';
    badge.textContent = item.edition + (item.concept ? ' / 布局构思' : ' / 新视角');
    copy.append(badge);
  }
  copy.append(description); const number = document.createElement('span'); number.className = 'card-index'; number.textContent = item.id.slice(1);
  caption.append(copy, number); card.append(button, caption); return card;
}
filters.forEach(button => button.addEventListener('click', () => applyFilter(button.dataset.filter)));
document.querySelector('#close').addEventListener('click', closeImage);
document.querySelector('#previous').addEventListener('click', () => showImage(current - 1));
document.querySelector('#next').addEventListener('click', () => showImage(current + 1));
document.querySelector('#zoom').addEventListener('click', () => {
  const zoomed = stage.classList.toggle('zoomed');
  viewerImage.src = imageUrl(zoomed ? visible[current].original : visible[current].image);
  document.querySelector('#zoom').setAttribute('aria-pressed', String(zoomed));
  document.querySelector('#zoom').textContent = zoomed ? '适应屏幕' : '放大细看';
});
viewer.addEventListener('close', () => {
  document.body.style.overflow = '';
  history.replaceState(null, '', location.pathname + location.search);
  resetZoom(); returnFocus?.focus();
});
viewer.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight') { event.preventDefault(); showImage(current + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); showImage(current - 1); }
});
stage.addEventListener('touchstart', event => {
  startTouch = event.touches.length === 1 && !stage.classList.contains('zoomed') ? [event.touches[0].clientX, event.touches[0].clientY] : null;
}, { passive: true });
stage.addEventListener('touchend', event => {
  if (!startTouch || stage.classList.contains('zoomed') || event.touches.length) return;
  const end = event.changedTouches[0], dx = end.clientX - startTouch[0], dy = end.clientY - startTouch[1];
  startTouch = null;
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) showImage(current + (dx < 0 ? 1 : -1));
}, { passive: true });
fetch('images.json').then(response => {
  if (!response.ok) throw new Error('Image catalog unavailable');
  return response.json();
}).then(catalog => {
  images = catalog.images; visible = images;
  document.querySelector('#total-count').textContent = String(images.length).padStart(2, '0');
  document.querySelector('#filter-count').textContent = String(images.length).padStart(2, '0');
  gallery.append(...images.map(createCard));
  applyFilter(activeFilter, false);
  const requested = location.hash.slice(1);
  if (images.some(item => item.id === requested)) openImage(requested, gallery.querySelector('[data-id="' + requested + '"] button'));
}).catch(() => { document.querySelector('#load-error').hidden = false; });
