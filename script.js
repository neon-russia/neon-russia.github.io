const DB = 'https://neon-russia-default-rtdb.firebaseio.com/';
let currentUser = JSON.parse(localStorage.getItem('neon_user')) || null;
let db = { users: {}, nodes: {}, subtabs: {}, topics: {}, posts: {} };
let pathStack = ['root'], activeTopicId = null, activeSubtabId = null, targetPid = null;

const ROLES = [
	{ key: 'founder', label: 'Основатель' }, { key: 'co-founder', label: 'Со-основатель' },
	{ key: 'project-team', label: 'Команда проекта' }, { key: 'technical-specialist', label: 'Технический специалист' },
	{ key: 'head-admin', label: 'Главный Администратор' }, { key: 'co-head-admin', label: 'Зам. Главного Администратора' },
	{ key: 'administrative-supervisor', label: 'Куратор администрации' }, { key: 'gs-zgs', label: 'ГС/ЗГС' },
	{ key: 'senior-admin', label: 'Старший администратор' }, { key: 'admin', label: 'Администратор' },
	{ key: 'senior-moder', label: 'Старший модератор' }, { key: 'moder', label: 'Модератор' },
	{ key: 'junior-moder', label: 'Младший модератор' }, { key: 'pr-manager', label: 'Пиар-менеджер' },
	{ key: 'media-partner', label: 'Медиа-партнер' }, { key: 'player', label: 'Игрок' }
];

const makeRoleFlags = () => {
	const flags = {};
	ROLES.forEach(r => flags[r.key] = (r.key === 'player'));
	return flags;
};

const getUserRole = u => (!u ? ROLES.at(-1) : (ROLES.find(r => u[r.key] === true) || ROLES.at(-1)));
const safeKey = s => s.toLowerCase().replace(/[.#$\[\]\/]/g, '_');


const seedNodes = {
	cat_main: { id: 'cat_main', parentId: 'root', title: '⚡ Основной раздел', order: 1 },
	news: { id: 'news', parentId: 'cat_main', title: 'Новости и обновления проекта', desc: 'Актуальная информация и патчи.', icon: '📢', order: 1 },
	rules: { id: 'rules', parentId: 'cat_main', title: 'Правила проекта', desc: 'Общие правила серверов и форума.', icon: '📜', order: 2 },
	cat_srv: { id: 'cat_srv', parentId: 'root', title: '🌐 Игровые серверы', order: 2 },
	s1: { id: 's1', parentId: 'cat_srv', title: 'Сервер №1 | MOSCOW', desc: 'Вкладки первого сервера.', icon: '01', order: 1 },
	s1_gos: { id: 's1_gos', parentId: 's1', title: 'Государственные организации', desc: 'ФСБ, УМВД, ГИБДД, Армия, Правительство.', icon: '🏛️', order: 1 },
	s1_fsb: { id: 's1_fsb', parentId: 's1_gos', title: 'ФСБ', desc: 'Федеральная служба безопасности.', icon: '🛡️', order: 1 },
	s1_opg: { id: 's1_opg', parentId: 's1', title: 'Криминальные организации', desc: 'Арзамасская, Батыревская, Лыткаринская ОПГ.', icon: '🔫', order: 2 },
	s1_jb: { id: 's1_jb', parentId: 's1', title: 'Жалобы', desc: 'Жалобы на игроков, лидеров и администрацию.', icon: '⚖️', order: 3 },
	s2: { id: 's2', parentId: 'cat_srv', title: 'Сервер №2 | Не работает!', desc: 'Вкладки второго сервера.', icon: '02', order: 2 }
};

async function api(path, method = 'GET', body = null) {
	const opts = body !== null ? { method, body: JSON.stringify(body) } : { method };
	return (await fetch(`${DB}/${path}.json`, opts)).json();
}

async function syncCloud() {
	try {
		const data = await api('');
		if (!data || !data.nodes) { await api('nodes', 'PUT', seedNodes); db.nodes = seedNodes; }
		else db.nodes = data.nodes || {};
		db.users = data?.users || {}; db.subtabs = data?.subtabs || {}; db.topics = data?.topics || {}; db.posts = data?.posts || {};
		for (let k in db.users) {
			if (typeof db.users[k].founder === 'undefined') {
				db.users[k] = { username: db.users[k].username || k, pass: db.users[k].pass || '1234', ...makeRoleFlags() };
				await api(`users/${k}`, 'PUT', db.users[k]);
			}
		}
		if (currentUser && db.users[safeKey(currentUser.username)]) {
			currentUser = db.users[safeKey(currentUser.username)];
			localStorage.setItem('neon_user', JSON.stringify(currentUser));
		}
		refreshUI();
	} catch (e) { console.error(e); }
}

const getChildren = pid => Object.values(db.nodes).filter(n => n.parentId === pid).sort((a, b) => (a.order || 99) - (b.order || 99));
const getSubtabs = nid => Object.values(db.subtabs).filter(s => s.nodeId === nid).sort((a, b) => (a.created || 0) - (b.created || 0));
const getTopics = nid => Object.values(db.topics).filter(t => t.nodeId === nid).sort((a, b) => b.created - a.created);
const getPosts = tid => Object.values(db.posts).filter(p => p.topicId === tid).sort((a, b) => a.created - b.created);
function countStats(nid) {
	let tList = getTopics(nid), t = tList.length, p = tList.reduce((s, top) => s + getPosts(top.id).length, 0);
	for (let c of getChildren(nid)) { const sub = countStats(c.id); t += sub.t; p += sub.p; }
	return { t, p };
}

function refreshUI() {
	if (document.getElementById('tab-forums').style.display !== 'none') renderExplorer();
	if (document.getElementById('tab-users').style.display !== 'none') renderUsers();
	if (document.getElementById('tab-new').style.display !== 'none') renderNew();
	if (document.getElementById('tab-topic').style.display !== 'none' && activeTopicId) renderPosts();
	if (document.getElementById('tab-subtab').style.display !== 'none' && activeSubtabId) { renderSubtabPosts(); updateSubtabLockUI(); }
	renderStaff();
}
function renderExplorer() {
	const curId = pathStack[pathStack.length - 1], curTitle = curId === 'root' ? 'Главная' : (db.nodes[curId]?.title || 'Вкладка');
	document.getElementById('btn-back').style.display = pathStack.length > 1 ? 'inline-block' : 'none';
	document.getElementById('btn-new-subtab').style.display = pathStack.length > 1 ? 'inline-block' : 'none';
	document.getElementById('btn-new-topic').style.display = pathStack.length > 1 ? 'inline-block' : 'none';
	document.getElementById('breadcrumbs').innerHTML = pathStack.map((id, i) => `<span style="cursor:pointer;color:${i === pathStack.length - 1 ? '#fff' : 'var(--muted)'}" onclick="jumpTo(${i})">${id === 'root' ? 'Главная' : (db.nodes[id]?.title || '')}</span>`).join(' / ');

	if (curId === 'root') {
		document.getElementById('explorer-content').innerHTML = getChildren('root').map(cat => `<section class="category-block"><div class="category-header" style="display:flex;justify-content:space-between;align-items:center;"><h2>${cat.title}</h2><button class="btn btn-login" style="padding:4px 10px;font-size:11px;" onclick="openSubModal('${cat.id}')">+ Вкладка</button></div><div class="forum-list">${renderNodes(getChildren(cat.id))}</div></section>`).join('');
		return;
	}
	const subs = getChildren(curId), subtabs = getSubtabs(curId), tops = getTopics(curId);
	let html = subs.length ? `<section class="category-block"><div class="category-header"><h2>📁 Вкладки: ${curTitle}</h2></div><div class="forum-list">${renderNodes(subs)}</div></section>` : '';
	if (subtabs.length) html += `<section class="category-block"><div class="category-header"><h2>📄 Подвкладки (информация)</h2></div><div class="forum-list">${subtabs.map(st => `<div class="forum-item" onclick="openSubtab('${st.id}')"><div class="forum-icon ${st.closed ? '' : 'unread'}">${st.closed ? '🔒' : '📄'}</div><div class="forum-info"><span class="forum-title">${st.title}</span><p class="forum-desc">${st.closed ? 'Закрыто для ответов' : 'Нажмите, чтобы открыть'}</p></div><div class="forum-stats"><div><span>${st.closed ? 'Закрыто' : 'Открыто'}</span></div></div><div class="forum-last-post"><span class="last-post-title">Открыть →</span><div class="last-post-meta">${st.author || ''}</div></div></div>`).join('')}</div></section>`;
	html += `<section class="category-block"><div class="category-header"><h2>💬 Темы вкладки</h2></div><div class="forum-list">${tops.length ? tops.map(t => { const ps = getPosts(t.id), last = ps[ps.length - 1] || {}; return `<div class="forum-item" onclick="openTopic('${t.id}')"><div class="forum-icon unread">💬</div><div class="forum-info"><span class="forum-title">${t.title}</span><p class="forum-desc">Автор: ${t.author}</p></div><div class="forum-stats"><div><span>${ps.length}</span> сообщ.</div></div><div class="forum-last-post"><span class="last-post-title">${last.author || t.author}</span><div class="last-post-meta">${last.time || ''}</div></div></div>`; }).join('') : `<div class="widget-body" style="color:var(--muted);font-size:13px;">Тем пока нет.</div>`}</div></section>`;
	document.getElementById('explorer-content').innerHTML = html;
}

function renderNodes(list) {
	if (!list.length) return `<div class="widget-body" style="color:var(--muted);font-size:13px;">Пусто. Создайте первую вкладку!</div>`;
	return list.map(n => {
		const st = countStats(n.id), subs = getChildren(n.id), tags = subs.length ? `<div class="sub-tags">${subs.map(s => `<span class="sub-tag">📁 ${s.title}</span>`).join('')}</div>` : '';
		return `<div class="forum-item" onclick="openNode('${n.id}')"><div class="forum-icon ${subs.length ? 'unread' : ''}">${n.icon || '📁'}</div><div class="forum-info"><span class="forum-title">${n.title}</span><p class="forum-desc">${n.desc || 'Вкладка'}</p>${tags}</div><div class="forum-stats"><div><span>${st.t}</span> тем</div><div><span>${st.p}</span> сообщ.</div></div><div class="forum-last-post"><div class="last-post-meta">${subs.length ? 'Вкладок: ' + subs.length : 'Открыть →'}</div></div></div>`;
	}).join('');
}

const openNode = id => { pathStack.push(id); showTab('forums'); renderExplorer(); };
const jumpTo = i => { pathStack = pathStack.slice(0, i + 1); showTab('forums'); renderExplorer(); };
const goBack = () => { if (pathStack.length > 1) { pathStack.pop(); renderExplorer(); } };
const goHome = () => { pathStack = ['root']; showTab('forums'); renderExplorer(); };
const openSubModal = (pid = null) => { targetPid = pid || pathStack[pathStack.length - 1]; openModal('sub-modal'); };
const openSubtabModal = () => openModal('subtab-modal');
const openTopicModal = () => (!currentUser ? (openModal('login-modal'), showToast('Войдите в аккаунт')) : openModal('topic-modal'));

async function handleCreateSub(e) {
	e.preventDefault(); const id = 'n_' + Date.now();
	db.nodes[id] = { id, parentId: targetPid, title: document.getElementById('sub-title').value.trim(), desc: document.getElementById('sub-desc').value.trim(), icon: '📁', order: Date.now() };
	closeModal('sub-modal'); e.target.reset(); renderExplorer(); await api(`nodes/${id}`, 'PUT', db.nodes[id]); showToast('Вкладка сохранена!');
}
async function handleCreateSubtab(e) {
	e.preventDefault(); const id = 'st_' + Date.now();
	db.subtabs[id] = { id, nodeId: pathStack[pathStack.length - 1], title: document.getElementById('st-title').value.trim(), text: document.getElementById('st-body').value.trim(), author: currentUser ? currentUser.username : 'Администрация', closed: false, created: Date.now() };
	closeModal('subtab-modal'); e.target.reset(); renderExplorer(); await api(`subtabs/${id}`, 'PUT', db.subtabs[id]); showToast('Подвкладка создана!');
}
async function handleCreateTopic(e) {
	e.preventDefault(); const now = Date.now(), tid = 't_' + now, pid = 'p_' + now, time = 'Сегодня в ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	db.topics[tid] = { id: tid, nodeId: pathStack[pathStack.length - 1], title: document.getElementById('top-title').value.trim(), author: currentUser.username, created: now };
	db.posts[pid] = { id: pid, topicId: tid, author: currentUser.username, text: document.getElementById('top-body').value.trim(), time, created: now };
	closeModal('topic-modal'); e.target.reset(); renderExplorer(); await Promise.all([api(`topics/${tid}`, 'PUT', db.topics[tid]), api(`posts/${pid}`, 'PUT', db.posts[pid])]); showToast('Тема создана!');
}

function renderPostHtml(p) {
	const r = getUserRole(db.users[safeKey(p.author)]);
	return `<div class="post-item"><div class="post-author"><div class="avatar neon-pink">${p.author.charAt(0).toUpperCase()}</div><div class="staff-name r-${r.key}">${p.author}</div><div class="role-badge r-${r.key}">${r.label}</div></div><div class="post-content"><div class="post-date">${p.time}</div><p>${p.text.replace(/\n/g, '<br>')}</p></div></div>`;
}
function openSubtab(id) {
	const st = db.subtabs[id]; if (!st) return; activeSubtabId = id;
	document.getElementById('subtab-breadcrumb').innerText = pathStack.map(x => x === 'root' ? 'Главная' : db.nodes[x]?.title).join(' / ') + ' / ' + st.title;
	document.getElementById('subtab-view-body').innerHTML = st.text.replace(/\n/g, '<br>');
	updateSubtabLockUI(); renderSubtabPosts(); showTab('subtab');
}
function updateSubtabLockUI() {
	const st = db.subtabs[activeSubtabId]; if (!st) return; const c = !!st.closed;
	document.getElementById('subtab-view-title').innerText = (c ? '🔒 ' : '') + st.title;
	document.getElementById('subtab-reply-section').style.display = c ? 'none' : 'block';
	document.getElementById('subtab-closed-notice').style.display = c ? 'block' : 'none';
	const btn = document.getElementById('btn-toggle-subtab'), ok = currentUser && (getUserRole(currentUser).key !== 'player' || st.author === currentUser.username);
	btn.style.display = ok ? 'inline-block' : 'none'; btn.innerText = c ? '🔓 Открыть подвкладку' : '🔒 Закрыть подвкладку';
}
async function toggleSubtabLock() { const st = db.subtabs[activeSubtabId]; if (!st) return; st.closed = !st.closed; updateSubtabLockUI(); await api(`subtabs/${activeSubtabId}`, 'PUT', st); showToast(st.closed ? 'Закрыто!' : 'Открыто!'); }
function renderSubtabPosts() { const l = getPosts(activeSubtabId); document.getElementById('subtab-replies-block').style.display = l.length ? 'block' : 'none'; document.getElementById('subtab-posts-container').innerHTML = l.map(renderPostHtml).join(''); }
async function submitSubtabReply() {
	if (!currentUser) { openModal('login-modal'); return showToast('Войдите в аккаунт'); }
	if (db.subtabs[activeSubtabId]?.closed) return showToast('Подвкладка закрыта!');
	const inp = document.getElementById('subtab-reply-text'); if (!inp.value.trim()) return;
	const now = Date.now(), pid = 'p_' + now, time = 'Сегодня в ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	db.posts[pid] = { id: pid, topicId: activeSubtabId, author: currentUser.username, text: inp.value.trim(), time, created: now };
	inp.value = ''; renderSubtabPosts(); await api(`posts/${pid}`, 'PUT', db.posts[pid]); showToast('Ответ отправлен!');
}
const closeSubtab = () => { activeSubtabId = null; showTab('forums'); renderExplorer(); };

function openTopic(tid) { activeTopicId = tid; const top = db.topics[tid]; document.getElementById('topic-breadcrumb').innerText = pathStack.map(id => id === 'root' ? 'Главная' : db.nodes[id]?.title).join(' / ') + ' / ' + top.title; document.getElementById('topic-view-title').innerText = top.title; renderPosts(); showTab('topic'); }
const renderPosts = () => { document.getElementById('topic-posts-container').innerHTML = getPosts(activeTopicId).map(renderPostHtml).join(''); };
async function submitReply() {
	if (!currentUser) { openModal('login-modal'); return showToast('Войдите в аккаунт'); }
	const inp = document.getElementById('reply-text'); if (!inp.value.trim()) return;
	const now = Date.now(), pid = 'p_' + now, time = 'Сегодня в ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	db.posts[pid] = { id: pid, topicId: activeTopicId, author: currentUser.username, text: inp.value.trim(), time, created: now };
	inp.value = '';
	renderPosts();
	await api(`posts/${pid}`, 'PUT', db.posts[pid]);
	showToast('Ответ сохранён!');
}

const closeTopic = () => { activeTopicId = null; showTab('forums'); renderExplorer(); };

function showTab(t) {
	['forums', 'subtab', 'new', 'users', 'topic'].forEach(id => document.getElementById('tab-' + id).style.display = (id === t) ? 'block' : 'none');
	document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
	if (document.getElementById('nav-' + t)) document.getElementById('nav-' + t).classList.add('active');
	refreshUI();
}

function renderUsers() {
	const dir = document.getElementById('users-directory');
	if (!dir) return;
	const l = Object.values(db.users);
	const gaIndex = ROLES.findIndex(r => r.key === 'head-admin');
	const myIdx = currentUser ? ROLES.findIndex(r => r.key === getUserRole(currentUser).key) : -1;
	const canManage = myIdx !== -1 && myIdx < gaIndex; // Доступ только для должностей выше ГА

	dir.innerHTML = l.length ? l.map(u => {
		const r = getUserRole(u);
		const targetIdx = ROLES.findIndex(role => role.key === r.key);
		const canEditThisUser = canManage && (myIdx === 0 || targetIdx >= myIdx);

		const selectHtml = canEditThisUser ? `
			<select class="neon-input" style="width:auto; padding:5px 10px; margin-left:auto;" onchange="setUserRole('${safeKey(u.username)}', this.value)">
				${ROLES.filter((_, idx) => myIdx === 0 || idx >= myIdx).map(role => `<option value="${role.key}" ${role.key === r.key ? 'selected' : ''}>${role.label}</option>`).join('')}
			</select>` : '';

		return `<div class="user-card-row">
			<div class="avatar neon-pink">${u.username.charAt(0).toUpperCase()}</div>
			<div>
				<div class="staff-name r-${r.key}">${u.username}</div>
				<div class="staff-role r-${r.key}">${r.label}</div>
			</div>
			${selectHtml}
		</div>`;
	}).join('') : `<div style="color:var(--muted);font-size:13px;">Пока нет участников.</div>`;
}

async function setUserRole(userKey, newRoleKey) {
	if (!db.users[userKey]) return;
	ROLES.forEach(r => db.users[userKey][r.key] = (r.key === newRoleKey));
	await api(`users/${userKey}`, 'PUT', db.users[userKey]);
	refreshUI();
	showToast('Звание обновлено!');
}

function renderStaff() {
	const b = document.querySelector('.sidebar .widget-body'); if (!b) return;
	const maxIndex = ROLES.findIndex(r => r.key === 'administrative-supervisor');

	const s = Object.values(db.users)
		.filter(u => {
			const idx = ROLES.findIndex(r => r.key === getUserRole(u).key);
			return idx !== -1 && idx <= maxIndex;
		})
		.sort((a, b) => {
			return ROLES.findIndex(r => r.key === getUserRole(a).key) - ROLES.findIndex(r => r.key === getUserRole(b).key);
		});

	b.innerHTML = s.length ? s.map(u => {
		const r = getUserRole(u);
		return `<div class="staff-item"><div class="avatar neon-pink">${u.username.charAt(0).toUpperCase()}</div><div><div class="staff-name r-${r.key}">${u.username}</div><div class="staff-role r-${r.key}">${r.label}</div></div></div>`;
	}).join('') : `<div style="color:var(--muted);font-size:13px;">Список администрации пуст</div>`;
}

function renderNew() {
	const l = Object.values(db.topics).sort((a, b) => b.created - a.created);
	document.getElementById('whats-new-list').innerHTML = l.length ? l.map(t => `<div class="forum-item"><div class="forum-icon unread">🆕</div><div class="forum-info"><span class="forum-title">${t.title}</span><p class="forum-desc">Автор: ${t.author} • ${db.nodes[t.nodeId]?.title || ''}</p></div></div>`).join('') : `<div class="widget-body" style="color:var(--muted);font-size:13px;">Тем пока нет.</div>`;
}

const updateAuthUI = () => {
	document.getElementById('auth-area').innerHTML = currentUser
		? `<div class="user-badge"><span class="user-dot"></span><span>${currentUser.username}</span></div><button class="btn btn-login" onclick="logout()">Выйти</button>`
		: `<button class="btn btn-login" onclick="openModal('login-modal')">Вход</button><button class="btn btn-register" onclick="openModal('register-modal')">Регистрация</button>`;
};

async function handleRegister(e) {
	e.preventDefault();
	const u = document.getElementById('reg-username').value.trim(), pass = document.getElementById('reg-pass').value, k = safeKey(u);
	if (db.users[k]) return showToast('Никнейм занят!');
	db.users[k] = { username: u, pass, ...makeRoleFlags() };
	currentUser = db.users[k];
	localStorage.setItem('neon_user', JSON.stringify(currentUser));
	await api(`users/${k}`, 'PUT', currentUser);
	closeModal('register-modal'); updateAuthUI(); refreshUI(); showToast('Аккаунт создан!');
}

async function handleLogin(e) {
	e.preventDefault();
	const u = document.getElementById('login-username').value.trim(), pass = document.getElementById('login-pass').value, found = db.users[safeKey(u)];
	if (!found) return showToast('Аккаунт не найден!');
	if (found.pass && found.pass !== pass) return showToast('Неверный пароль!');
	currentUser = found;
	localStorage.setItem('neon_user', JSON.stringify(found));
	closeModal('login-modal'); updateAuthUI(); refreshUI(); showToast('Добро пожаловать, ' + found.username + '!');
}

const logout = () => { localStorage.removeItem('neon_user'); currentUser = null; updateAuthUI(); };

document.getElementById('modals-container').innerHTML = `
	<div class="modal-overlay" id="register-modal"><div class="modal-box">
		<div class="modal-header"><h3>Регистрация</h3><button class="modal-close" onclick="closeModal('register-modal')">×</button></div>
		<form onsubmit="handleRegister(event)">
			<label class="input-label">Никнейм</label><input type="text" id="reg-username" class="neon-input" required>
			<label class="input-label">Пароль</label><input type="password" id="reg-pass" class="neon-input" required>
			<button type="submit" class="btn btn-register full-width">Создать аккаунт</button>
		</form>
	</div></div>
	<div class="modal-overlay" id="login-modal"><div class="modal-box">
		<div class="modal-header"><h3>Вход</h3><button class="modal-close" onclick="closeModal('login-modal')">×</button></div>
		<form onsubmit="handleLogin(event)">
			<label class="input-label">Никнейм</label><input type="text" id="login-username" class="neon-input" required>
			<label class="input-label">Пароль</label><input type="password" id="login-pass" class="neon-input" required>
			<button type="submit" class="btn btn-register full-width">Войти</button>
		</form>
	</div></div>
	<div class="modal-overlay" id="sub-modal"><div class="modal-box">
		<div class="modal-header"><h3>Новая вкладка</h3><button class="modal-close" onclick="closeModal('sub-modal')">×</button></div>
		<form onsubmit="handleCreateSub(event)">
			<label class="input-label">Название</label><input type="text" id="sub-title" class="neon-input" required>
			<label class="input-label">Описание</label><input type="text" id="sub-desc" class="neon-input">
			<button type="submit" class="btn btn-register full-width">Создать</button>
		</form>
	</div></div>
	<div class="modal-overlay" id="subtab-modal"><div class="modal-box">
		<div class="modal-header"><h3>Новая подвкладка</h3><button class="modal-close" onclick="closeModal('subtab-modal')">×</button></div>
		<form onsubmit="handleCreateSubtab(event)">
			<label class="input-label">Название</label><input type="text" id="st-title" class="neon-input" required>
			<label class="input-label">Текст</label><textarea id="st-body" class="neon-input" rows="5" required></textarea>
			<button type="submit" class="btn btn-register full-width">Сохранить</button>
		</form>
	</div></div>
	<div class="modal-overlay" id="topic-modal"><div class="modal-box">
		<div class="modal-header"><h3>Новая тема</h3><button class="modal-close" onclick="closeModal('topic-modal')">×</button></div>
		<form onsubmit="handleCreateTopic(event)">
			<label class="input-label">Заголовок</label><input type="text" id="top-title" class="neon-input" required>
			<label class="input-label">Сообщение</label><textarea id="top-body" class="neon-input" rows="4" required></textarea>
			<button type="submit" class="btn btn-register full-width">Опубликовать</button>
		</form>
	</div></div>
`;

const openModal = id => document.getElementById(id).style.display = 'flex';
const closeModal = id => document.getElementById(id).style.display = 'none';
const showToast = msg => { const t = document.getElementById('toast'); t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); };

updateAuthUI();
syncCloud();
setInterval(syncCloud, 3000);
