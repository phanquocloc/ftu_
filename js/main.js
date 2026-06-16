// ════════════════════════════════════
//  SUPABASE CONFIGURATION
// ════════════════════════════════════
const SUPABASE_URL = 'https://dfrvsyjfklgvhyrzbxnk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1ibNF58LBtl2MS7xLko0iQ_UcavNfyk';
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ════════════════════════════════════
//  DATA
// ════════════════════════════════════
let currentUser = null;
let currentDetailBook = null;
let selectedBookType = 'Photo';
let selectedCond = 'Tốt';
let uploadedImgs = [];
let wishedIds = new Set();

// Active filters
let activeFilters = { cat: '', type: '', cond: '', status: '', priceFrom: 0, priceTo: 0 };
let currentPage = 1;
const ITEMS_PER_PAGE = 12;

// Local data cache
let BOOKS = [];
let NOTIFS = [];

// Sample books for initial demo (will be replaced by Supabase data)
const SAMPLE_BOOKS = [];

// ════════════════════════════════════
//  HELPERS
// ════════════════════════════════════
function fmtPrice(p) { return p.toLocaleString('vi-VN') + ' ₫'; }
function getInitials(name) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(); }

// ════════════════════════════════════
//  SUPABASE DATA FUNCTIONS
// ════════════════════════════════════
async function loadBooksFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (data && data.length > 0) {
      BOOKS = data;
    } else {
      // Load sample books if database is empty
      BOOKS = [...SAMPLE_BOOKS];
    }
  } catch (error) {
    console.error('Error loading books:', error);
    BOOKS = [...SAMPLE_BOOKS];
  }
}

async function saveBookToSupabase(book) {
  try {
    const { data, error } = await supabase
      .from('books')
      .insert([book])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving book:', error);
    throw error;
  }
}

async function updateBookInSupabase(bookId, updates) {
  try {
    const { data, error } = await supabase
      .from('books')
      .update(updates)
      .eq('id', bookId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating book:', error);
    throw error;
  }
}

async function loadNotificationsFromSupabase(userId) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (data) {
      NOTIFS = data;
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
    showToast('Lỗi tải thông báo: ' + (error.message || ''), 'error');
  }
}

async function saveNotificationToSupabase(notification) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([notification]);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving notification:', error);
    showToast('Lỗi lưu thông báo: ' + (error.message || ''), 'error');
  }
}

async function updateProfileInSupabase(updates) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', currentUser.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}

// ════════════════════════════════════
//  AUTH
// ════════════════════════════════════
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => t.classList.toggle('active', (tab === 'login' && i === 0) || (tab === 'register' && i === 1)));
  document.getElementById('auth-login').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('auth-register').style.display = tab === 'register' ? '' : 'none';
}

function checkFTUEmail(el) {
  const hint = document.getElementById('reg-email-hint');
  if (el.value.endsWith('@ftu.edu.vn')) { hint.style.color = '#16A34A'; hint.textContent = '✅ Email hợp lệ'; }
  else if (el.value.length > 5) { hint.style.color = '#C8102E'; hint.textContent = '❌ Chỉ chấp nhận email @ftu.edu.vn'; }
  else { hint.style.color = ''; hint.textContent = 'Nhập email sinh viên Ngoại Thương'; }
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;

  if (!email || !pass) { showToast('Vui lòng nhập đầy đủ thông tin', 'error'); return; }

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Đang đăng nhập...';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: pass
    });

    if (error) throw error;

    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    currentUser = {
      id: data.user.id,
      email: data.user.email,
      name: userProfile?.name || data.user.email,
      mssv: userProfile?.mssv || '',
      major: userProfile?.major || '',
      facebook: userProfile?.facebook || '',
      zalo: userProfile?.zalo || ''
    };

    await loginSuccess();
  } catch (error) {
    showToast('Đăng nhập thất bại: ' + (error.message || 'Vui lòng kiểm tra lại thông tin'), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Đăng nhập';
  }
}

async function doRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const mssv = document.getElementById('reg-mssv').value.trim();
  const major = document.getElementById('reg-major').value;

  if (!name || !email || !pass) { showToast('Vui lòng điền đầy đủ', 'error'); return; }
  if (pass.length < 8) { showToast('Mật khẩu tối thiểu 8 ký tự', 'error'); return; }

  const btn = document.getElementById('btn-register');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Đang tạo tài khoản...';

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: pass,
      options: {
        data: {
          name: name
        }
      }
    });

    if (error) throw error;

    // Update user profile with additional info
    if (data.user) {
      if (!data.session) {
        showToast('Đăng ký thành công! Vui lòng kiểm tra email của bạn để xác thực tài khoản trước khi đăng nhập.', 'success');
        switchAuthTab('login');
        return;
      }

      await supabase
        .from('users')
        .update({ mssv, major })
        .eq('id', data.user.id);

      currentUser = {
        id: data.user.id,
        email: data.user.email,
        name: name,
        mssv: mssv,
        major: major,
        facebook: '',
        zalo: ''
      };

      await loginSuccess();
    }
  } catch (error) {
    showToast('Đăng ký thất bại: ' + (error.message || 'Email có thể đã được sử dụng'), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Tạo tài khoản';
  }
}

async function loginSuccess() {
  document.getElementById('view-auth').classList.remove('active');
  document.getElementById('view-app').classList.add('active');

  await loadBooksFromSupabase();
  await loadNotificationsFromSupabase(currentUser.id);

  // Update nav
  const initials = getInitials(currentUser.name);
  document.getElementById('nav-avatar').textContent = initials;
  document.getElementById('nav-username').textContent = currentUser.name;
  document.getElementById('prof-avatar').textContent = initials;
  document.getElementById('prof-name').textContent = currentUser.name;
  document.getElementById('prof-email').textContent = currentUser.email;
  document.getElementById('prof-name-input').value = currentUser.name;
  document.getElementById('prof-email-input').value = currentUser.email;
  document.getElementById('prof-facebook').value = currentUser.facebook || '';
  document.getElementById('prof-zalo').value = currentUser.zalo || '';

  // Set join date
  if (currentUser.created_at) {
    const date = new Date(currentUser.created_at);
    document.getElementById('prof-join-date').textContent =
      `${date.getDate()} tháng ${date.getMonth() + 1}, ${date.getFullYear()}`;
  }

  updateContactDisplay();
  renderHomeBooks();
  renderNotifDropdown();
  renderInbox();
  renderMyBooks();
  renderWishlist();
  updateNotifCount();
  initRealtimeChat();

  showToast(`Chào mừng ${currentUser.name}! 👋`, 'success');
}

async function doLogout() {
  await supabase.auth.signOut();
  if (chatChannel) { supabase.removeChannel(chatChannel); chatChannel = null; }
  activeChat = null;
  document.getElementById('view-app').classList.remove('active');
  document.getElementById('view-auth').classList.add('active');
  currentUser = null;
  BOOKS = [];
  NOTIFS = [];
  wishedIds.clear();
  ['login-email', 'login-pass', 'reg-name', 'reg-email', 'reg-mssv', 'reg-pass'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  switchAuthTab('login');
  showToast('Đã đăng xuất');
}

// Check for existing session on load
async function checkSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      currentUser = {
        id: session.user.id,
        email: session.user.email,
        name: userProfile?.name || session.user.email,
        mssv: userProfile?.mssv || '',
        major: userProfile?.major || '',
        facebook: userProfile?.facebook || '',
        zalo: userProfile?.zalo || '',
        created_at: userProfile?.created_at
      };

      await loginSuccess();
    }
  } catch (error) {
    console.error('Error checking session:', error);
  }
}

// ════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════
function gotoPage(pageId) {
  if (pageId === 'allbooks') {
    pageId = 'home';
    setTimeout(() => { document.getElementById('home-books-section').scrollIntoView({ behavior: 'smooth' }); }, 100);
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  // Update nav links
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
  const navMap = { home: 'nav-home', post: 'nav-post', mybooks: 'nav-mybooks', yeuthich: 'nav-yeu-thich', messages: 'nav-messages' };
  if (navMap[pageId]) document.getElementById(navMap[pageId])?.classList.add('active');
  window.scrollTo(0, 0);
  if (pageId === 'home') renderAllBooks();
  if (pageId === 'mybooks') { loadBooksFromSupabase().then(() => renderMyBooks()); }
  if (pageId === 'inbox') renderInbox();
  if (pageId === 'yeuthich') renderWishlist();
  if (pageId === 'messages') {
    document.getElementById('nav-msg-badge').style.display = 'none';
    document.getElementById('nav-msg-badge').textContent = '0';
    renderMessagesPage();
  }
  closeAllDropdowns();
}

// ════════════════════════════════════
//  DROPDOWNS
// ════════════════════════════════════
function toggleDropdown(id) {
  const el = document.getElementById(id);
  const wasOpen = el.classList.contains('open');
  closeAllDropdowns();
  if (!wasOpen) el.classList.add('open');
}
function closeAllDropdowns() {
  document.querySelectorAll('.notif-dropdown,.user-dropdown').forEach(d => d.classList.remove('open'));
}
document.addEventListener('click', e => {
  if (!e.target.closest('.user-dropdown-wrap')) closeAllDropdowns();
});

// Random notifications task
setInterval(() => {
  if (BOOKS.length === 0) return;
  // Pick random book not owned by user
  const availableBooks = BOOKS.filter(b => b.status === 'selling' && b.seller_id !== currentUser?.id);
  if (availableBooks.length > 0) {
    const randomBook = availableBooks[Math.floor(Math.random() * availableBooks.length)];
    // 20% chance to show a toast every 45 seconds
    if (Math.random() < 0.2) {
      showToast(`🌟 Khám phá sách mới: "${randomBook.title}" giá chỉ ${fmtPrice(randomBook.price)}`, 'success');
    }
  }
}, 45000);

// ════════════════════════════════════
//  BOOK CARDS
// ════════════════════════════════════
const condClassMap = { 'Mới': 'cond-moi', 'Như mới': 'cond-nhumu', 'Tốt': 'cond-tot', 'Khá': 'cond-kha', 'Cũ': 'cond-cu' };

function bookCardHTML(book) {
  const wished = wishedIds.has(book.id);
  const isMine = currentUser && (book.seller_id === currentUser.id || book.seller_email === currentUser.email);

  let actionButton = `<button class="btn-buy-card" onclick="event.stopPropagation();openDetail(${book.id})">Đặt mua</button>`;
  if (isMine) {
    actionButton = `<button class="btn-buy-card btn-edit-price" onclick="event.stopPropagation();promptEditPrice(${book.id})">
      <svg style="width:14px;height:14px;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      Điều chỉnh giá
    </button>`;
  }

  return `<div class="book-card ${isMine ? 'book-card-mine' : ''}" onclick="openDetail(${book.id})">
    <div class="book-card-img">
      ${book.imgs && book.imgs[0] && book.imgs[0].startsWith('data:')
      ? `<img src="${book.imgs[0]}" alt="${book.title}">`
      : `<div class="book-cover-placeholder">${book.imgs[0] || '📗'}</div>`}
      <span class="badge-avail">Có sẵn</span>
      <span class="badge-type${book.type === 'Xuất bản' ? ' xuatban' : ''}">${book.type === 'Xuất bản' ? 'Xuất bản' : 'Photo'}</span>
      <button class="wish-btn${wished ? ' active' : ''}" onclick="event.stopPropagation();toggleWish(${book.id},this)">
        <svg viewBox="0 0 24 24" fill="${wished ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
    </div>
    <div class="book-card-body">
      <div class="book-dept">${book.dept}</div>
      <div class="book-title-card">${book.title}</div>
      <div class="book-author-card">${book.author}</div>
      <div class="book-price-row">
        <div class="book-price-val">${fmtPrice(book.price)}</div>
        <span class="book-cond-badge ${condClassMap[book.cond] || 'cond-cu'}">${book.cond}</span>
      </div>
      <div class="book-seller-row">
        <span><span class="seller-avatar-sm">${book.seller_name.charAt(0).toUpperCase()}</span>${book.seller_name}</span>
        <span>${relativeDate(book.date)}</span>
      </div>
      ${actionButton}
    </div>
  </div>`;
}

async function promptEditPrice(id) {
  const book = BOOKS.find(b => b.id === id);
  if (!book) return;

  const newPriceStr = prompt(`Nhập giá mới cho cuốn "${book.title}":`, book.price);
  if (newPriceStr !== null) {
    const newPrice = parseInt(newPriceStr.replace(/\D/g, ''));
    if (!isNaN(newPrice) && newPrice > 0) {
      try {
        // Update local immediately for responsive UI
        book.price = newPrice;
        renderHomeBooks();
        if (document.getElementById('page-mybooks').classList.contains('active')) renderMyBooks();

        // Update Supabase
        await supabase.from('books').update({ price: newPrice }).eq('id', id);
        showToast('✅ Đã cập nhật giá mới thành công!', 'success');
      } catch (err) {
        showToast('Lỗi cập nhật giá: ' + err.message, 'error');
      }
    } else {
      showToast('Giá nhập vào không hợp lệ', 'error');
    }
  }
}

function relativeDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  if (diff <= 30) return `${diff} ngày trước`;
  return dateStr;
}

function renderHomeBooks() {
  renderAllBooks();
}

// ════════════════════════════════════
//  ALL BOOKS + FILTERS
// ════════════════════════════════════
function getFilteredBooks() {
  return BOOKS.filter(b => {
    if (b.status === 'done') return false; // Hide sold books from home/all
    if (activeFilters.cat && b.dept !== activeFilters.cat) return false;
    if (activeFilters.type && b.type !== activeFilters.type) return false;
    if (activeFilters.cond && b.cond !== activeFilters.cond) return false;
    if (activeFilters.status && b.status !== activeFilters.status) return false;
    if (activeFilters.priceFrom && b.price < activeFilters.priceFrom) return false;
    if (activeFilters.priceTo && b.price > activeFilters.priceTo) return false;
    return true;
  });
}

function renderAllBooks() {
  const filtered = getFilteredBooks();
  const total = filtered.length;
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const paged = filtered.slice(start, start + ITEMS_PER_PAGE);
  document.getElementById('allbooks-count').textContent = `${total} kết quả`;
  document.getElementById('results-info').textContent = total > 0 ? `Hiển thị ${start + 1}–${Math.min(start + ITEMS_PER_PAGE, total)} trên ${total} kết quả` : 'Không có kết quả';
  document.getElementById('allbooks-grid').innerHTML = paged.length ? paged.map(bookCardHTML).join('') :
    `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📭</div><h3>Không tìm thấy sách</h3><p>Thử thay đổi bộ lọc</p></div>`;
  renderPagination(total);
}

function renderPagination(total) {
  const pages = Math.ceil(total / ITEMS_PER_PAGE);
  if (pages <= 1) { document.getElementById('pagination').innerHTML = ''; return; }
  let html = `<button class="pg-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
  </button>`;
  for (let i = 1; i <= pages; i++) {
    html += `<button class="pg-btn${i === currentPage ? ' active' : ''}" onclick="changePage(${i})">${i}</button>`;
  }
  html += `<button class="pg-btn" onclick="changePage(${currentPage + 1})" ${currentPage === pages ? 'disabled' : ''}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
  </button>`;
  document.getElementById('pagination').innerHTML = html;
}

function changePage(p) {
  const filtered = getFilteredBooks();
  const pages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  if (p < 1 || p > pages) return;
  currentPage = p; renderAllBooks(); window.scrollTo(0, 200);
}

function filterCat(btn, cat) {
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  activeFilters.cat = cat; currentPage = 1;
  const hasClear = cat || activeFilters.type || activeFilters.cond || activeFilters.status;
  document.getElementById('clear-filter-btn').style.display = hasClear ? '' : 'none';
  renderAllBooks();
}

function setFilterChip(btn, key, val) {
  btn.closest('.filter-chips').querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  activeFilters[key] = val; currentPage = 1;
  renderAllBooks();
  document.getElementById('clear-filter-btn').style.display = 'flex';
}

function applyPriceFilter() {
  activeFilters.priceFrom = parseInt(document.getElementById('price-from').value) || 0;
  activeFilters.priceTo = parseInt(document.getElementById('price-to').value) || 0;
  currentPage = 1; renderAllBooks();
  document.getElementById('clear-filter-btn').style.display = 'flex';
}

function updatePriceSlider(val) {
  val = parseInt(val);
  const displayEl = document.getElementById('price-slider-val');
  if (val >= 5000000) {
    displayEl.textContent = 'Tất cả mức giá';
    activeFilters.priceTo = 0;
  } else {
    displayEl.textContent = 'Dưới ' + fmtPrice(val);
    activeFilters.priceTo = val;
  }
  activeFilters.priceFrom = 0;
  currentPage = 1;
  const hasClear = activeFilters.cat || activeFilters.type || activeFilters.cond || activeFilters.status || activeFilters.priceTo > 0;
  document.getElementById('clear-filter-btn').style.display = hasClear ? 'flex' : 'none';
  
  document.getElementById('price-to').value = activeFilters.priceTo || '';
  document.getElementById('price-from').value = '';
  
  renderAllBooks();
}

function clearAllFilters() {
  activeFilters = { cat: '', type: '', cond: '', status: '', priceFrom: 0, priceTo: 0 };
  currentPage = 1;
  document.querySelectorAll('.cat-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  document.querySelectorAll('.filter-chip').forEach(c => {
    const parent = c.closest('.filter-chips');
    if (parent.children[0] === c) c.classList.add('active'); else c.classList.remove('active');
  });
  document.getElementById('price-from').value = '';
  document.getElementById('price-to').value = '';
  const slider = document.getElementById('main-price-slider');
  if (slider) {
    slider.value = 5000000;
    document.getElementById('price-slider-val').textContent = 'Tất cả mức giá';
  }
  document.getElementById('clear-filter-btn').style.display = 'none';
  renderAllBooks();
}

function toggleFilterPanel() {
  const p = document.getElementById('filter-panel');
  const open = p.classList.toggle('open');
  document.getElementById('filter-arrow').textContent = open ? '▴' : '▾';
}

function setView(v) {
  const grid = document.getElementById('allbooks-grid');
  document.getElementById('view-grid-btn').classList.toggle('active', v === 'grid');
  document.getElementById('view-list-btn').classList.toggle('active', v === 'list');
  if (v === 'list') {
    grid.style.gridTemplateColumns = '1fr';
  } else {
    grid.style.gridTemplateColumns = '';
  }
}

function heroSearch(q) {
  gotoPage('home');
  document.getElementById('home-books-section').scrollIntoView({ behavior: 'smooth' });
  if (!q) { clearAllFilters(); return; }

  setTimeout(() => {
    activeFilters = { cat: '', type: '', cond: '', status: '', priceFrom: 0, priceTo: 0 };
    const filtered = BOOKS.filter(b =>
      b.title.toLowerCase().includes(q.toLowerCase()) ||
      b.author.toLowerCase().includes(q.toLowerCase()) ||
      b.dept.toLowerCase().includes(q.toLowerCase())
    );
    document.getElementById('allbooks-grid').innerHTML = filtered.length ? filtered.map(bookCardHTML).join('') :
      `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📭</div><h3>Không tìm thấy sách</h3><p>Thử từ khóa khác</p></div>`;
    document.getElementById('allbooks-count').textContent = `${filtered.length} kết quả`;
    document.getElementById('results-info').textContent = `Tìm kiếm: "${q}"`;
    document.getElementById('pagination').innerHTML = '';
  }, 100);
}

// ════════════════════════════════════
//  BOOK DETAIL
// ════════════════════════════════════
function openDetail(id) {
  const book = BOOKS.find(b => b.id === id); if (!book) return;
  currentDetailBook = book;
  const wished = wishedIds.has(book.id);
  document.getElementById('detail-content').innerHTML = `
    <div class="detail-img-wrap">
      ${book.imgs && book.imgs[0] && book.imgs[0].startsWith('data:')
      ? `<img src="${book.imgs[0]}" alt="${book.title}" style="width:100%;height:100%;object-fit:cover;">`
      : `<span style="font-size:100px">${book.imgs[0] || '📗'}</span>`}
    </div>
    <div>
      <div class="detail-badges">
        <span class="detail-badge db-avail">${book.status === 'selling' ? 'Có sẵn' : book.status === 'exchanging' ? 'Đang chờ duyệt' : 'Đã bán'}</span>
        <span class="detail-badge db-type">${book.type === 'Photo' ? 'Sách Photo' : 'Sách Xuất Bản'}</span>
      </div>
      <h1 class="detail-title">${book.title}</h1>
      <div class="detail-author">${book.author}</div>
      <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:20px">
        <div class="detail-price">${fmtPrice(book.price)}</div>
        <span class="book-cond-badge ${condClassMap[book.cond] || 'cond-cu'} detail-cond-inline">${book.cond}</span>
      </div>
      <div class="detail-notes-box">
        <div class="detail-notes-title">Mô tả / Ghi chú</div>
        ${book.notes || 'Không có ghi chú'}
      </div>
      <div class="seller-card">
        <div class="seller-card-title">Người đăng</div>
        <div class="seller-info">
          <div class="seller-avatar-lg">${book.seller_name.charAt(0).toUpperCase()}</div>
          <div>
            <div class="seller-name">${book.seller_name}</div>
            <div class="seller-role">Sinh viên FTU</div>
          </div>
        </div>
      </div>
      <div class="contact-reveal-box" id="contact-box">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
          <h4 style="margin:0">Thông tin liên hệ người bán</h4>
          ${currentUser && currentUser.id !== book.seller_id ? `<button class="btn-buy-card" style="width:auto; padding:6px 16px; margin:0" onclick="startChat('${book.seller_id}', '${book.seller_name.replace(/'/g, "\\'")}', ${book.id})"><svg style="width:14px;height:14px;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Chat trực tiếp</button>` : ''}
        </div>
        <div class="contact-links" style="display:flex;gap:12px;flex-wrap:wrap">
          ${book.contact ? `<a href="${book.contact.startsWith('http') ? book.contact : 'https://' + book.contact}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="contact-icon-btn contact-fb-btn" title="Mo Facebook"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg><span>Facebook</span></a>` : '<div class="contact-icon-btn contact-disabled"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg><span>Chua co FB</span></div>'}
          ${book.zalo_number ? `<a href="https://zalo.me/${book.zalo_number}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="contact-icon-btn contact-zalo-btn" title="Mo Zalo"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.04 2 11c0 2.62 1.23 4.96 3.15 6.57L4 22l4.79-2.06C9.82 20.3 10.88 20.5 12 20.5c5.52 0 10-4.04 10-9S17.52 2 12 2z"/></svg><span>Zalo</span></a>` : '<div class="contact-icon-btn contact-disabled"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.04 2 11c0 2.62 1.23 4.96 3.15 6.57L4 22l4.79-2.06C9.82 20.3 10.88 20.5 12 20.5c5.52 0 10-4.04 10-9S17.52 2 12 2z"/></svg><span>Chua co Zalo</span></div>'}
        </div>
      </div>
      <button class="btn-contact" onclick="revealContact()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.71 3.38 2 2 0 0 1 3.68 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        Xem thông tin liên hệ
      </button>
      <div class="detail-action-row">
        ${currentUser && (book.seller_id === currentUser.id || book.seller_email === currentUser.email)
      ? `<button class="btn-buy-detail" style="background:#C9960C" onclick="promptEditPrice(${book.id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Điều chỉnh giá
            </button>`
      : `<button class="btn-buy-detail" onclick="doBuy(${book.id})" ${book.status !== 'selling' ? 'disabled style="opacity:0.5"' : ''}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              ${book.status === 'selling' ? 'Đặt mua' : book.status === 'exchanging' ? 'Đang chờ duyệt' : 'Đã bán'}
            </button>`
    }
        <button class="btn-action-sm" onclick="toggleWishDetail(${book.id},this)">
          <svg viewBox="0 0 24 24" fill="${wished ? 'var(--red)' : 'none'}" stroke="${wished ? 'var(--red)' : 'currentColor'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          ${wished ? 'Đã yêu thích' : 'Yêu thích'}
        </button>
        <button class="btn-action-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          Báo cáo
        </button>
      </div>
    </div>`;
  gotoPage('detail');
}

function revealContact() {
  document.getElementById('contact-box')?.classList.add('show');
  showToast('Đã hiển thị thông tin liên hệ');
}

async function doBuy(id) {
  const book = BOOKS.find(b => b.id === id); if (!book) return;
  if (currentUser && book.seller_email === currentUser.email) { showToast('Đây là sách của bạn', 'error'); return; }
  if (book.status !== 'selling') { showToast('Sách này đã có người đặt mua', 'error'); return; }

  // Update book status to 'exchanging' (pending seller approval)
  book.status = 'exchanging';
  book.buyer_id = currentUser?.id || null;
  book.buyer_name = currentUser?.name || 'Người mua';
  await updateBookInSupabase(id, { status: 'exchanging', buyer_id: book.buyer_id, buyer_name: book.buyer_name });

  // Create notification for seller - request approval
  if (currentUser) {
    await saveNotificationToSupabase({
      user_id: book.seller_id,
      type: 'buy_request',
      title: 'Yêu cầu mua sách mới!',
      body: `${currentUser.name} muốn mua cuốn "${book.title}" của bạn. Vào mục "Đang trao đổi" để duyệt.`,
      book_id: id,
      unread: true
    });
  }

  showToast('Đã gửi yêu cầu mua! Chờ người bán duyệt.', 'success');
  renderHomeBooks();

  // Chuyển hướng sang tab Đang trao đổi
  gotoPage('mybooks');
  setTimeout(() => {
    const btn = document.querySelector('.mybooks-tab[onclick*="mb-exchange"]');
    if (btn) switchMybooksTab(btn, 'mb-exchange');
  }, 50);
}

function toggleWish(id, btn) {
  if (wishedIds.has(id)) {
    wishedIds.delete(id); btn.classList.remove('active');
    btn.querySelector('svg').setAttribute('fill', 'none');
    btn.querySelector('svg').setAttribute('stroke', 'currentColor');
    showToast('💔 Đã xóa khỏi yêu thích');
  } else {
    wishedIds.add(id); btn.classList.add('active');
    btn.querySelector('svg').setAttribute('fill', 'currentColor');
    btn.querySelector('svg').setAttribute('stroke', 'currentColor');
    showToast('❤️ Đã thêm vào yêu thích', 'success');

    // Create notification
    const book = BOOKS.find(b => b.id === id);
    if (currentUser && book && book.seller_email !== currentUser.email) {
      saveNotificationToSupabase({
        user_id: book.seller_id,
        type: 'like',
        title: 'Ai đó đã thích sách của bạn!',
        body: `${currentUser.name} đã thêm cuốn "${book.title}" vào danh sách yêu thích.`,
        book_id: id,
        unread: true
      });
    }
  }
  renderWishlist();
}

function toggleWishDetail(id, btn) {
  if (wishedIds.has(id)) {
    wishedIds.delete(id);
    showToast('💔 Đã xóa khỏi yêu thích');
  } else {
    wishedIds.add(id);
    showToast('❤️ Đã thêm vào yêu thích', 'success');

    // Create notification
    const book = BOOKS.find(b => b.id === id);
    if (currentUser && book && book.seller_email !== currentUser.email) {
      saveNotificationToSupabase({
        user_id: book.seller_id,
        type: 'like',
        title: 'Ai đó đã thích sách của bạn!',
        body: `${currentUser.name} đã thêm cuốn "${book.title}" vào danh sách yêu thích.`,
        book_id: id,
        unread: true
      });
    }
  }
  renderWishlist();
}

function renderWishlist() {
  const grid = document.getElementById('wishlist-grid');
  const wished = BOOKS.filter(b => wishedIds.has(b.id));
  grid.innerHTML = wished.length ? wished.map(bookCardHTML).join('') :
    `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">❤️</div><h3>Chưa có sách yêu thích</h3><p>Bấm ❤️ trên các cuốn sách để lưu lại</p></div>`;
}

// ════════════════════════════════════
//  NOTIFICATIONS
// ════════════════════════════════════
function updateNotifCount() {
  const unread = NOTIFS.filter(n => n.unread).length;
  document.getElementById('notif-count-badge').textContent = unread;
  document.getElementById('notif-count-badge').style.display = unread > 0 ? 'flex' : 'none';
}

function renderNotifDropdown() {
  document.getElementById('notif-drop-list').innerHTML = NOTIFS.slice(0, 4).length ?
    NOTIFS.slice(0, 4).map(n => `
    <div class="notif-item-drop${n.unread ? ' unread' : ''}">
      <div class="notif-icon-drop">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
      </div>
      <div class="notif-body-drop">
        <h4>${n.title}</h4>
        <p>${n.body.substring(0, 60)}...</p>
        <div class="ntime">${new Date(n.created_at).toLocaleString('vi-VN')}</div>
      </div>
      ${n.unread ? '<div class="notif-unread-dot"></div>' : ''}
    </div>`).join('') :
    '<div style="padding:20px;text-align:center;color:var(--gray-400)">Không có thông báo</div>';
}

function renderInbox() {
  const allHtml = NOTIFS.length ? NOTIFS.map(n => `
    <div class="inbox-item${n.unread ? ' unread' : ''}">
      ${n.unread ? '<div class="inbox-unread-dot"></div>' : ''}
      <div class="inbox-item-header">
        <div class="inbox-item-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </div>
        <div class="inbox-item-body">
          <div class="inbox-item-title">${n.title}${n.unread ? '<span class="inbox-item-new-badge">Mới</span>' : ''}</div>
          <div class="inbox-item-desc">${n.body}</div>
          <div class="inbox-item-meta">${new Date(n.created_at).toLocaleString('vi-VN')}</div>
        </div>
      </div>
    </div>`).join('') :
    '<div class="empty-state"><div class="empty-icon">📭</div><h3>Không có thông báo</h3></div>';

  const unreadHtml = NOTIFS.filter(n => n.unread).length ?
    NOTIFS.filter(n => n.unread).map(n => `
    <div class="inbox-item unread">
      <div class="inbox-unread-dot"></div>
      <div class="inbox-item-header">
        <div class="inbox-item-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </div>
        <div class="inbox-item-body">
          <div class="inbox-item-title">${n.title}<span class="inbox-item-new-badge">Mới</span></div>
          <div class="inbox-item-desc">${n.body}</div>
          <div class="inbox-item-meta">${new Date(n.created_at).toLocaleString('vi-VN')}</div>
        </div>
      </div>
    </div>`).join('') :
    '<div class="empty-state"><div class="empty-icon">✅</div><h3>Tất cả đã đọc</h3></div>';

  document.getElementById('inbox-list').innerHTML = allHtml;
  document.getElementById('inbox-unread-list').innerHTML = unreadHtml;

  const unread = NOTIFS.filter(n => n.unread).length;
  document.getElementById('inbox-sub-text').textContent = `${NOTIFS.length} thông báo · ${unread} chưa đọc`;
  document.getElementById('inbox-all-count').textContent = NOTIFS.length;
  document.getElementById('inbox-unread-count').textContent = unread;
}

async function markAllRead() {
  NOTIFS.forEach(n => n.unread = false);

  // Update in Supabase
  for (const n of NOTIFS) {
    await supabase
      .from('notifications')
      .update({ unread: false })
      .eq('id', n.id);
  }

  updateNotifCount(); renderInbox(); renderNotifDropdown();
  showToast('Đã đánh dấu tất cả đã đọc', 'success');
}

function switchInboxTab(btn, tabId) {
  btn.closest('.inbox-tabs').querySelectorAll('.inbox-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  ['inbox-all', 'inbox-unread'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  document.getElementById(tabId).style.display = '';
}

// ════════════════════════════════════
//  MY BOOKS
// ════════════════════════════════════
function myBookRowHTML(book, context) {
  const statusMap = { selling: 'ms-available', exchanging: 'ms-exchange', done: 'ms-done' };
  const statusLabel = { selling: 'Có sẵn', exchanging: 'Đang trao đổi', done: 'Đã hoàn thành' };
  const isExchanging = book.status === 'exchanging';
  const isSeller = currentUser && book.seller_email === currentUser.email;
  const isBuyer = currentUser && book.buyer_id === currentUser.id;

  // Build action buttons based on context
  let actionHTML = '';
  if (isExchanging && isSeller) {
    // Seller sees approve/reject buttons
    actionHTML = `
      <div class="mybook-buyer-info" style="font-size:12px;color:var(--gray-500);margin-bottom:4px">
        👤 Người mua: <strong>${book.buyer_name || 'Ẩn danh'}</strong>
      </div>
      <button class="btn-complete-deal" onclick="event.stopPropagation();askCompleteDeal(${book.id})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Duyệt bán
      </button>
      <button class="btn-reject-deal" onclick="event.stopPropagation();askRejectDeal(${book.id})" style="margin-top:4px;padding:6px 14px;border-radius:8px;border:1.5px solid var(--red);background:transparent;color:var(--red);font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;transition:all .2s">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Từ chối
      </button>`;
  } else if (isExchanging && isBuyer) {
    // Buyer sees pending status
    actionHTML = `
      <div style="font-size:12px;color:var(--amber-600, #D97706);font-weight:500;display:flex;align-items:center;gap:4px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Chờ người bán duyệt
      </div>`;
  } else if (isExchanging) {
    actionHTML = `<button class="btn-complete-deal" onclick="event.stopPropagation();askCompleteDeal(${book.id})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Hoàn thành
      </button>`;
  }

  return `<div class="mybook-row" onclick="openDetail(${book.id})">
    <div class="mybook-img">${book.imgs && book.imgs[0] && book.imgs[0].startsWith('data:') ? `<img src="${book.imgs[0]}" alt="${book.title}">` : book.imgs[0] || '📗'}</div>
    <div class="mybook-info">
      <div class="mybook-name">${book.title}</div>
      <span class="mybook-type-badge">${book.type}</span>
      <div class="mybook-author">${book.author}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
        <div class="mybook-price">${fmtPrice(book.price)}</div>
        <div class="mybook-date">${book.date || new Date(book.created_at).toISOString().split('T')[0]}</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
      <span class="mybook-status ${statusMap[book.status] || 'ms-available'}">${statusLabel[book.status] || 'Có sẵn'}</span>
      ${actionHTML}
    </div>
  </div>`;
}

function renderMyBooks() {
  if (!currentUser) return;
  const mine = BOOKS.filter(b => b.seller_email === currentUser.email);
  const boughtDone = BOOKS.filter(b => b.buyer_id === currentUser.id && b.status === 'done');
  const buyingPending = BOOKS.filter(b => b.buyer_id === currentUser.id && b.status === 'exchanging');

  const all = mine.length ? mine.map(b => myBookRowHTML(b, 'all')).join('') : '<div class="empty-state"><div class="empty-icon">📚</div><h3>Chưa có sách nào</h3><p>Đăng sách đầu tiên của bạn!</p></div>';
  document.getElementById('mybooks-list').innerHTML = all;
  document.getElementById('mybooks-selling-list').innerHTML = mine.filter(b => b.status === 'selling').map(b => myBookRowHTML(b, 'selling')).join('') || '<div class="empty-state"><div class="empty-icon">📭</div><h3>Không có sách đang bán</h3></div>';

  // "Đang trao đổi" tab: sách mình bán đang chờ duyệt + sách mình mua đang chờ duyệt
  const exchangeSellerBooks = mine.filter(b => b.status === 'exchanging');
  const allExchangeBooks = [...exchangeSellerBooks.map(b => myBookRowHTML(b, 'exchange-seller')), ...buyingPending.filter(b => !exchangeSellerBooks.find(s => s.id === b.id)).map(b => myBookRowHTML(b, 'exchange-buyer'))];
  document.getElementById('mybooks-exchange-list').innerHTML = allExchangeBooks.length ? allExchangeBooks.join('') : '<div class="empty-state"><div class="empty-icon">🤝</div><h3>Không có giao dịch đang diễn ra</h3></div>';

  document.getElementById('mybooks-done-list').innerHTML = mine.filter(b => b.status === 'done').map(b => myBookRowHTML(b, 'done')).join('') || '<div class="empty-state"><div class="empty-icon">🎉</div><h3>Chưa có giao dịch hoàn thành</h3></div>';

  // "Sách đã mua" tab: chỉ hiện sách đã được người bán duyệt (status: 'done')
  const boughtContainer = document.getElementById('mybooks-bought-list');
  if (boughtContainer) {
    boughtContainer.innerHTML = boughtDone.length ? boughtDone.map(b => myBookRowHTML(b, 'bought')).join('') : '<div class="empty-state"><div class="empty-icon">🛒</div><h3>Chưa mua cuốn sách nào</h3><p>Sách sẽ xuất hiện ở đây khi người bán duyệt đơn</p></div>';
  }

  document.getElementById('prof-book-count').textContent = `${mine.length} cuốn`;
  document.getElementById('prof-deal-count').textContent = `${mine.filter(b => b.status === 'done').length} giao dịch`;
}

function switchMybooksTab(btn, tabId) {
  btn.closest('.mybooks-tabs').querySelectorAll('.mybooks-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  ['mb-all', 'mb-selling', 'mb-exchange', 'mb-done', 'mb-bought'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  document.getElementById(tabId).style.display = '';
}

// ════════════════════════════════════
//  COMPLETE DEAL
// ════════════════════════════════════
let pendingCompleteId = null;

function askCompleteDeal(bookId) {
  const book = BOOKS.find(b => b.id === bookId); if (!book) return;
  pendingCompleteId = bookId;
  document.getElementById('confirm-modal-icon-el').textContent = '🎉';
  document.getElementById('confirm-ok-btn').textContent = '✅ Duyệt bán';
  document.getElementById('confirm-ok-btn').onclick = confirmCompleteDeal;
  document.getElementById('confirm-modal-msg').innerHTML = `Bạn muốn duyệt bán cuốn <strong>"${book.title}"</strong> cho <strong>${book.buyer_name || 'người mua'}</strong>?`;
  document.getElementById('confirm-overlay').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('open');
  pendingCompleteId = null;
  pendingRejectId = null;
  // Reset modal to default state
  document.getElementById('confirm-modal-icon-el').textContent = '🎉';
  document.getElementById('confirm-ok-btn').textContent = '✅ Duyệt bán';
  document.getElementById('confirm-ok-btn').onclick = confirmCompleteDeal;
}

async function confirmCompleteDeal() {
  if (!pendingCompleteId) return;
  const book = BOOKS.find(b => b.id === pendingCompleteId);
  if (book) {
    book.status = 'done';
    await updateBookInSupabase(pendingCompleteId, { status: 'done' });

    // Notify the buyer that the seller approved
    if (book.buyer_id) {
      await saveNotificationToSupabase({
        user_id: book.buyer_id,
        type: 'buy_approved',
        title: 'Đơn mua đã được duyệt! 🎉',
        body: `Người bán đã duyệt đơn mua cuốn "${book.title}". Liên hệ người bán để nhận sách nhé!`,
        book_id: pendingCompleteId,
        unread: true
      });
    }

    renderMyBooks();
    renderHomeBooks();
    showToast('🎉 Đã duyệt đơn mua! Giao dịch hoàn thành.', 'success');
  }
  closeConfirm();
}

// Reject deal - seller refuses the buy request
let pendingRejectId = null;

function askRejectDeal(bookId) {
  const book = BOOKS.find(b => b.id === bookId); if (!book) return;
  pendingRejectId = bookId;
  document.getElementById('confirm-modal-msg').innerHTML = `Bạn muốn từ chối yêu cầu mua cuốn <strong>"${book.title}"</strong> từ <strong>${book.buyer_name || 'người mua'}</strong>?`;
  document.getElementById('confirm-modal-icon-el').textContent = '❌';
  document.getElementById('confirm-ok-btn').textContent = '❌ Từ chối';
  document.getElementById('confirm-ok-btn').onclick = confirmRejectDeal;
  document.getElementById('confirm-overlay').classList.add('open');
}

async function confirmRejectDeal() {
  if (!pendingRejectId) return;
  const book = BOOKS.find(b => b.id === pendingRejectId);
  if (book) {
    const rejectedBuyerId = book.buyer_id;
    const rejectedBuyerName = book.buyer_name;

    book.status = 'selling';
    book.buyer_id = null;
    book.buyer_name = null;
    await updateBookInSupabase(pendingRejectId, { status: 'selling', buyer_id: null, buyer_name: null });

    // Notify the buyer about rejection
    if (rejectedBuyerId) {
      await saveNotificationToSupabase({
        user_id: rejectedBuyerId,
        type: 'buy_rejected',
        title: 'Yêu cầu mua bị từ chối',
        body: `Người bán đã từ chối yêu cầu mua cuốn "${book.title}". Bạn có thể tìm cuốn sách khác.`,
        book_id: pendingRejectId,
        unread: true
      });
    }

    renderMyBooks();
    renderHomeBooks();
    showToast('Đã từ chối yêu cầu mua. Sách đã trở về trạng thái "Có sẵn".', 'success');
  }
  closeConfirmAndReset();
}

function closeConfirmAndReset() {
  document.getElementById('confirm-overlay').classList.remove('open');
  pendingCompleteId = null;
  pendingRejectId = null;
  // Reset modal to default state
  document.getElementById('confirm-modal-icon-el').textContent = '🎉';
  document.getElementById('confirm-ok-btn').textContent = '✅ Hoàn thành';
  document.getElementById('confirm-ok-btn').onclick = confirmCompleteDeal;
}

// Close modal when clicking outside
document.getElementById('confirm-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeConfirmAndReset();
});

// ════════════════════════════════════
//  POST BOOK
// ════════════════════════════════════
function selectBookType(type, btn) {
  selectedBookType = type;
  document.querySelectorAll('.post-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function selectCond(btn, cond) {
  selectedCond = cond;
  document.querySelectorAll('.cond-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
}

// uploadedImgs stores base64 strings after reading
function handleImgUpload(input) {
  const files = Array.from(input.files).slice(0, 6 - uploadedImgs.length);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      uploadedImgs.push(e.target.result);
      renderImgPreview();
    };
    reader.readAsDataURL(file);
  });
  input.value = ''; // reset so same file can be re-added
}
function renderImgPreview() {
  document.getElementById('img-preview').innerHTML = uploadedImgs.map((src, i) => `
    <div class="uploaded-thumb">
      <img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" alt="ảnh ${i + 1}">
      <button class="rm-btn" onclick="removeImg(${i})">✕</button>
    </div>`).join('') +
    (uploadedImgs.length < 6 ? `<div class="uploaded-thumb" onclick="document.getElementById('img-upload').click()" style="cursor:pointer;border-style:dashed"><span style="font-size:22px;color:var(--gray-400)">+</span></div>` : '');
}
function removeImg(i) { uploadedImgs.splice(i, 1); renderImgPreview(); }

function updateContactDisplay() {
  document.getElementById('display-fb').textContent = currentUser?.facebook || 'Chưa có Facebook';
  document.getElementById('display-zalo').textContent = currentUser?.zalo ? `Zalo: ${currentUser.zalo}` : 'Chưa có Zalo';
}

async function submitPost() {
  const title = document.getElementById('p-title').value.trim();
  const author = document.getElementById('p-author').value.trim();
  const price = document.getElementById('p-price').value;
  const dept = document.getElementById('p-dept').value;

  if (!title || !author || !price || !dept) { showToast('Vui lòng điền đầy đủ thông tin bắt buộc (*)', 'error'); return; }
  if (!currentUser) { showToast('Vui lòng đăng nhập để đăng sách', 'error'); return; }

  const btn = document.getElementById('btn-submit-post');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Đang đăng...';

  try {
    const newBook = {
      title, author, dept, type: selectedBookType, cond: selectedCond,
      price: parseInt(price), notes: document.getElementById('p-notes').value || '',
      contact: currentUser?.facebook || '', zalo_number: currentUser?.zalo || '',
      seller_name: currentUser?.name || 'Bạn', seller_email: currentUser?.email || '',
      seller_id: currentUser?.id,
      status: 'selling', imgs: uploadedImgs.length ? [...uploadedImgs] : ['📗'],
      date: new Date().toISOString().split('T')[0]
    };

    const savedBook = await saveBookToSupabase(newBook);

    // Add to local cache
    BOOKS.unshift({ ...newBook, id: savedBook.id, created_at: savedBook.created_at });

    showToast('✅ Đăng sách thành công!', 'success');
    ['p-title', 'p-author', 'p-price', 'p-notes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('p-dept').value = '';
    uploadedImgs = []; renderImgPreview();
    renderHomeBooks(); renderMyBooks();
    gotoPage('home');
  } catch (error) {
    showToast('Lỗi khi đăng sách: ' + (error.message || 'Vui lòng thử lại'), 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Đăng sách`;
  }
}

// ════════════════════════════════════
//  PROFILE
// ════════════════════════════════════
function saveProfile() {
  if (!currentUser) return;
  currentUser.name = document.getElementById('prof-name-input').value;
  currentUser.facebook = document.getElementById('prof-facebook').value;
  currentUser.zalo = document.getElementById('prof-zalo').value;

  updateProfileInSupabase({
    name: currentUser.name,
    facebook: currentUser.facebook,
    zalo: currentUser.zalo
  }).then(() => {
    document.getElementById('nav-username').textContent = currentUser.name;
    const initials = getInitials(currentUser.name);
    document.getElementById('nav-avatar').textContent = initials;
    document.getElementById('prof-avatar').textContent = initials;
    document.getElementById('prof-name').textContent = currentUser.name;
    updateContactDisplay();

    // Đồng bộ contact cho tất cả sách của người này trong local cache
    BOOKS.forEach(b => {
      if (b.seller_id === currentUser.id) {
        b.contact = currentUser.facebook;
        b.zalo_number = currentUser.zalo;
      }
    });
    // Đồng bộ lên bảng books ở Supabase (chạy ngầm)
    supabase.from('books').update({
      contact: currentUser.facebook,
      zalo_number: currentUser.zalo
    }).eq('seller_id', currentUser.id).then();

    showToast('✅ Đã cập nhật hồ sơ', 'success');
  }).catch(error => {
    showToast('Lỗi khi cập nhật: ' + (error.message || 'Vui lòng thử lại'), 'error');
  });
}

function resetProfile() {
  document.getElementById('prof-name-input').value = currentUser?.name || '';
  document.getElementById('prof-facebook').value = currentUser?.facebook || '';
  document.getElementById('prof-zalo').value = currentUser?.zalo || '';
  showToast('Đã hoàn tác');
}

// ════════════════════════════════════
//  TOAST
// ════════════════════════════════════
function showToast(msg, type = '') {
  const tc = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  tc.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(110%)'; t.style.transition = 'all .3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ════════════════════════════════════
//  INITIALIZATION
// ════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  // Check for existing session
  await checkSession();

  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      document.getElementById('view-app').classList.remove('active');
      document.getElementById('view-auth').classList.add('active');
    }
  });
});
// ════════════════════════════════════
//  CHAT & REALTIME LOGIC
// ════════════════════════════════════
let activeChat = null; // { id, otherUser: { id, name }, bookId }
let chatMessages = [];
let chatChannel = null;
let userConversations = [];

function initRealtimeChat() {
  if (!currentUser || chatChannel) return;

  chatChannel = supabase.channel('public:changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const newMsg = payload.new;
      handleNewRealtimeMessage(newMsg);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
      const newNotif = payload.new;
      if (newNotif.user_id === currentUser.id) {
        NOTIFS.unshift(newNotif);
        updateNotifCount();
        renderNotifDropdown();
        renderInbox();
        showToast('🔔 ' + newNotif.title, 'success');
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'books' }, payload => {
      const updatedBook = payload.new;
      const idx = BOOKS.findIndex(b => b.id === updatedBook.id);
      if (idx !== -1) {
        BOOKS[idx] = { ...BOOKS[idx], ...updatedBook };
      }
      // Re-render if on mybooks page
      if (document.getElementById('page-mybooks').classList.contains('active')) {
        renderMyBooks();
      }
      renderHomeBooks();
    })
    .subscribe();
}

async function handleNewRealtimeMessage(msg) {
  const { data: conv } = await supabase
    .from('conversations')
    .select('user1_id, user2_id')
    .eq('id', msg.conversation_id)
    .single();

  if (!conv || (conv.user1_id !== currentUser.id && conv.user2_id !== currentUser.id)) {
    return;
  }

  if (activeChat && msg.conversation_id === activeChat.id) {
    if (!chatMessages.find(m => m.id === msg.id)) {
      chatMessages.push(msg);
      renderChatMessages();
    }
  }

  if (document.getElementById('page-messages').classList.contains('active')) {
    renderMessagesPage();
  } else {
    if (msg.sender_id !== currentUser.id) {
      const badge = document.getElementById('nav-msg-badge');
      badge.style.display = 'block';
      badge.textContent = parseInt(badge.textContent || '0') + 1;
      showToast('Bạn có tin nhắn mới!', 'success');
    }
  }
}

async function startChat(sellerId, sellerName, bookId) {
  if (!currentUser) { showToast('Vui lòng đăng nhập để chat', 'error'); return; }
  if (sellerId === currentUser.id) { showToast('Bạn không thể tự chat với chính mình', 'error'); return; }

  closeAllDropdowns();

  const widget = document.getElementById('chat-widget');
  widget.classList.add('open');
  document.getElementById('cw-name').textContent = sellerName;
  document.getElementById('cw-avatar').textContent = getInitials(sellerName);
  document.getElementById('cw-context').textContent = 'Đang kết nối...';
  document.getElementById('cw-body').innerHTML = '<div style="text-align:center;padding:20px"><div class="loading-spinner" style="border-top-color:var(--red)"></div></div>';

  try {
    let { data: convs, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('book_id', bookId);

    let conv = null;
    if (convs && convs.length > 0) {
      conv = convs.find(c =>
        (c.user1_id === currentUser.id && c.user2_id === sellerId) ||
        (c.user1_id === sellerId && c.user2_id === currentUser.id)
      );
    }

    if (!conv) {
      const { data: newConv, error: insertErr } = await supabase
        .from('conversations')
        .insert([{ user1_id: currentUser.id, user2_id: sellerId, book_id: bookId }])
        .select()
        .single();
      if (insertErr) throw insertErr;
      conv = newConv;
    }

    activeChat = { id: conv.id, otherUser: { id: sellerId, name: sellerName }, bookId };
    document.getElementById('cw-context').textContent = 'Có thể chat ngay';

    await loadMessagesForActiveChat();
    initRealtimeChat();
  } catch (error) {
    console.error('Lỗi khi mở chat:', error);
    document.getElementById('cw-body').innerHTML = '<div style="color:var(--red);text-align:center;padding:20px;font-size:13px">Không thể tải hộp chat. Vui lòng thử lại sau.<br>(Lưu ý: Cần tạo bảng trên Supabase)</div>';
  }
}

async function loadMessagesForActiveChat() {
  if (!activeChat) return;
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', activeChat.id)
    .order('created_at', { ascending: true });

  if (!error && data) {
    chatMessages = data;
    renderChatMessages();
  }
}

function renderChatMessages() {
  const body = document.getElementById('cw-body');
  if (chatMessages.length === 0) {
    body.innerHTML = '<div style="text-align:center;color:var(--gray-400);font-size:13px;margin-top:auto;margin-bottom:auto">Chưa có tin nhắn nào.<br>Hãy gửi lời chào!</div>';
    return;
  }

  body.innerHTML = chatMessages.map(m => {
    const isMine = m.sender_id === currentUser.id;
    const time = new Date(m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="msg-bubble ${isMine ? 'msg-mine' : 'msg-theirs'}">
        <div>${m.content}</div>
        <div class="msg-time" style="color:${isMine ? 'rgba(255,255,255,0.7)' : 'inherit'}">${time}</div>
      </div>
    `;
  }).join('');

  setTimeout(() => body.scrollTop = body.scrollHeight, 50);
}

async function sendMsgFromWidget() {
  const input = document.getElementById('cw-input');
  const content = input.value.trim();
  if (!content || !activeChat || !currentUser) return;

  input.value = '';
  const btn = document.getElementById('cw-send-btn');
  btn.disabled = true;

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        conversation_id: activeChat.id,
        sender_id: currentUser.id,
        content: content
      }])
      .select()
      .single();

    if (error) throw error;

    chatMessages.push(data);
    renderChatMessages();
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeChat.id);
  } catch (error) {
    console.error('Lỗi gửi tin nhắn:', error);
    showToast('Lỗi khi gửi tin nhắn: ' + (error.message || error.toString()), 'error');
  } finally {
    btn.disabled = false;
    input.focus();
  }
}

function closeChatWidget() {
  document.getElementById('chat-widget').classList.remove('open');
  activeChat = null;
}

async function renderMessagesPage() {
  if (!currentUser) {
    document.getElementById('conv-list-container').innerHTML = '<div style="padding:20px;text-align:center">Vui lòng đăng nhập</div>';
    return;
  }

  document.getElementById('conv-list-container').innerHTML = '<div style="padding:20px;text-align:center"><div class="loading-spinner" style="border-top-color:var(--red)"></div></div>';

  try {
    const { data: convs1, error: err1 } = await supabase
      .from('conversations')
      .select('*, messages(content, created_at, sender_id)')
      .eq('user1_id', currentUser.id);

    const { data: convs2, error: err2 } = await supabase
      .from('conversations')
      .select('*, messages(content, created_at, sender_id)')
      .eq('user2_id', currentUser.id);

    if (err1 || err2) throw err1 || err2;

    let convs = [...(convs1 || []), ...(convs2 || [])];

    // Bỏ qua các cuộc trò chuyện chưa có tin nhắn nào
    convs = convs.filter(c => c.messages && c.messages.length > 0);

    if (!convs || convs.length === 0) {
      document.getElementById('conv-list-container').innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray-400)">Chưa có tin nhắn nào</div>';
      return;
    }

    const otherUserIds = [...new Set(convs.map(c => c.user1_id === currentUser.id ? c.user2_id : c.user1_id))];
    let userMap = {};
    if (otherUserIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, name, email').in('id', otherUserIds);
      if (users) users.forEach(u => userMap[u.id] = u.name || u.email);
    }

    userConversations = convs.map(c => {
      const otherId = c.user1_id === currentUser.id ? c.user2_id : c.user1_id;
      const msgs = c.messages || [];
      msgs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const lastMsg = msgs[0];
      const bookContext = BOOKS.find(b => b.id === c.book_id)?.title || 'Sách ID: ' + c.book_id;
      return {
        id: c.id,
        otherUser: { id: otherId, name: userMap[otherId] || 'Người dùng ẩn' },
        bookId: c.book_id,
        bookTitle: bookContext,
        lastMsg: lastMsg ? lastMsg.content : 'Chưa có tin nhắn',
        lastMsgTime: lastMsg ? lastMsg.created_at : c.updated_at
      };
    });

    userConversations.sort((a, b) => new Date(b.lastMsgTime) - new Date(a.lastMsgTime));

    const html = userConversations.map(c => {
      const d = new Date(c.lastMsgTime);
      const timeStr = d.toLocaleDateString('vi-VN') === new Date().toLocaleDateString('vi-VN') ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('vi-VN');
      return `
        <div class="conv-item" onclick="openChatFromMessages('${c.id}')">
          <div class="conv-avatar">${getInitials(c.otherUser.name)}</div>
          <div class="conv-info">
            <div class="conv-header">
              <span class="conv-name">${c.otherUser.name}</span>
              <span class="conv-time">${timeStr}</span>
            </div>
            <div class="conv-lastmsg">${c.lastMsg}</div>
            <div class="conv-book">📘 ${c.bookTitle}</div>
          </div>
        </div>
      `;
    }).join('');

    document.getElementById('conv-list-container').innerHTML = html;
  } catch (error) {
    console.error(error);
    document.getElementById('conv-list-container').innerHTML = '<div style="padding:20px;text-align:center;color:var(--red)">Lỗi tải tin nhắn (Cần SQL setup)</div>';
  }
}

function openChatFromMessages(convId) {
  const conv = userConversations.find(c => c.id === convId);
  if (!conv) return;
  startChat(conv.otherUser.id, conv.otherUser.name, conv.bookId);
}
console.log("Debug NOTIFS:", NOTIFS);
