const DB = 'https://neon-russia-default-rtdb.firebaseio.com/';
let currentUser = JSON.parse(localStorage.getItem('neon_user')) || null;
let db = { users: {}, nodes: {}, subtabs: {}, topics: {}, posts: {} };
let pathStack = ['root'];
let activeTopicId = null;
let activeSubtabId = null;

const ROLES = [
	{ key: 'founder', label: 'Основатель' },
	{ key: 'co-founder', label: 'Со-основатель' },
	{ key: 'project-team', label: 'Команда проекта' },
	{ key: 'head-admin', label: 'Главный Администратор' },
	{ key: 'co-head-admin', label: 'Зам. Главного Администратора' },
	{ key: 'technical-specialist', label: 'Технический специалист' },
	{ key: 'administrative-supervisor', label: 'Куратор администрации' },
	{ key: 'player', label: 'Игрок' }
];

function makeRoleFlags() {
	return { founder: false, 'co-founder': false, 'project-team': false, 'head-admin': false, 'co-head-admin': false, 'technical-specialist': false, 'administrative-supervisor': false, player: true };
}

function getUserRole(uObj) {
	if (!uObj) return { key: 'player', label: 'Игрок' };
	for (let r of ROLES) { if (uObj[r.key] === true) return r; }
	return { key: 'player', label: 'Игрок' };
}

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
	const opts = { method };
	if (body !== null) opts.body = JSON.stringify(body);
	const res = await fetch(`${DB}/${path}.json`, opts);
	return res.json();
}

async function syncCloud() {
	try {
		const data = await api('');
		if (!data || !data.nodes) { await api('nodes', 'PUT', seedNodes); db.nodes = seedNodes; }
		else { db.nodes = data.nodes || {}; }
		db.users = (data && data.users) ? data.users : {};
		db.subtabs = (data && data.subtabs) ? data.subtabs : {};
		db.topics = (data && data.topics) ? data.topics : {};
		db.posts = (data && data.posts) ? data.posts : {};

		for (let k in db.users) {
			if (typeof db.users[k].founder === 'undefined') {
				const upgraded = { username: db.users[k].username || k, pass: db.users[k].pass || '1234', ...makeRoleFlags() };
				db.users[k] = upgraded;
				await api(`users/${k}`, 'PUT', upgraded);
			}
		}
		if (currentUser && db.users[safeKey(currentUser.username)]) {
			currentUser = db.users[safeKey(currentUser.username)];
			localStorage.setItem('neon_user', JSON.stringify(currentUser));
		}
		refreshUI();
	} catch (e) { console.error(e); }
}

function safeKey(str) { return str.toLowerCase().replace(/[.#$\[\]\/]/g, '_'); }
function getChildren(pid) { return Object.values(db.nodes).filter(n => n.parentId === pid).sort((a, b) => (a.order || 99) - (b.order || 99)); }
function getSubtabs(nid) { return Object.values(db.subtabs).filter(s => s.nodeId === nid).sort((a, b) => (a.created || 0) - (b.created || 0)); }
function getTopics(nid) { return Object.values(db.topics).filter(t => t.nodeId === nid).sort((a, b) => b.created - a.created); }
function getPosts(tid) { return Object.values(db.posts).filter(p => p.topicId === tid).sort((a, b) => a.created - b.created); }
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
	const curId = pathStack[pathStack.length - 1];
	const curTitle = curId === 'root' ? 'Главная' : (db.nodes[curId]?.title || 'Вкладка');
	document.getElementById('btn-back').style.display = pathStack.length > 1 ? 'inline-block' : 'none';
	document.getElementById('btn-new-subtab').style.display = pathStack.length > 1 ? 'inline-block' : 'none';
	document.getElementById('btn-new-topic').style.display = pathStack.length > 1 ? 'inline-block' : 'none';
	document.getElementById('breadcrumbs').innerHTML = pathStack.map((id, i) => `<span style="cursor:pointer;color:${i === pathStack.length - 1 ? '#fff' : 'var(--muted)'}" onclick="jumpTo(${i})">${id === 'root' ? 'Главная' : (db.nodes[id]?.title || '')}</span>`).join(' / ');

	let html = '';
	if (curId === 'root') {
		html = getChildren('root').map(cat => `<section class="category-block"><div class="category-header" style="display:flex;justify-content:space-between;align-items:center;"><h2>${cat.title}</h2><button class="btn btn-login" style="padding:4px 10px;font-size:11px;" onclick="openSubModal('${cat.id}')">+ Вкладка</button></div><div class="forum-list">${renderNodes(getChildren(cat.id))}</div></section>`).join('');
	} else {
		const subs = getChildren(curId), subtabs = getSubtabs(curId), tops = getTopics(curId);
		if (subs.length) html += `<section class="category-block"><div class="category-header"><h2>📁 Вкладки: ${curTitle}</h2></div><div class="forum-list">${renderNodes(subs)}</div></section>`;
		if (subtabs.length) html += `<section class="category-block"><div class="category-header"><h2>📄 Подвкладки (информация)</h2></div><div class="forum-list">${subtabs.map(st => `<div class="forum-item" onclick="openSubtab('${st.id}')"><div class="forum-icon ${st.closed ? '' : 'unread'}">${st.closed ? '🔒' : '📄'}</div><div class="forum-info"><span class="forum-title">${st.title}</span><p class="forum-desc">${st.closed ? 'Закрыто для ответов' : 'Нажмите, чтобы открыть'}</p></div><div class="forum-stats"><div><span>${st.closed ? 'Закрыто' : 'Открыто'}</span></div></div><div class="forum-last-post"><span class="last-post-title">Открыть →</span><div class="last-post-meta">${st.author || ''}</div></div></div>`).join('')}</div></section>`;
		html += `<section class="category-block"><div class="category-header"><h2>💬 Темы вкладки</h2></div><div class="forum-list">${tops.length ? tops.map(t => { const ps = getPosts(t.id), last = ps[ps.length - 1] || {}; return `<div class="forum-item" onclick="openTopic('${t.id}')"><div class="forum-icon unread">💬</div><div class="forum-info"><span class="forum-title">${t.title}</span><p class="forum-desc">Автор: ${t.author}</p></div><div class="forum-stats"><div><span>${ps.length}</span> сообщ.</div></div><div class="forum-last-post"><span class="last-post-title">${last.author || t.author}</span><div class="last-post-meta">${last.time || ''}</div></div></div>`; }).join('') : `<div class="widget-body" style="color:var(--muted);font-size:13px;">Тем пока нет. Нажмите «+ Вкладка», «+ Подвкладка» или «+ Тема»!</div>`}</div></section>`;
	}
	document.getElementById('explorer-content').innerHTML = html;
}

function renderNodes(list) {
	if (!list.length) return `<div class="widget-body" style="color:var(--muted);font-size:13px;">Пусто. Создайте первую вкладку!</div>`;
	return list.map(n => {
		const st = countStats(n.id), subs = getChildren(n.id);
		const tags = subs.length ? `<div class="sub-tags">${subs.map(s => `<span class="sub-tag">📁 ${s.title}</span>`).join('')}</div>` : '';
		return `<div class="forum-item" onclick="openNode('${n.id}')"><div class="forum-icon ${subs.length ? 'unread' : ''}">${n.icon || '📁'}</div><div class="forum-info"><span class="forum-title">${n.title}</span><p class="forum-desc">${n.desc || 'Вкладка'}</p>${tags}</div><div class="forum-stats"><div><span>${st.t}</span> тем</div><div><span>${st.p}</span> сообщ.</div></div><div class="forum-last-post"><div class="last-post-meta">${subs.length ? 'Вкладок: ' + subs.length : 'Открыть →'}</div></div></div>`;
	}).join('');
}

function openNode(id) { pathStack.push(id); showTab('forums'); renderExplorer(); }
function jumpTo(i) { pathStack = pathStack.slice(0, i + 1); showTab('forums'); renderExplorer(); }
function goBack() { if (pathStack.length > 1) { pathStack.pop(); renderExplorer(); } }
function goHome() { pathStack = ['root']; showTab('forums'); renderExplorer(); }

let targetPid = null;
function openSubModal(pid = null) { targetPid = pid || pathStack[pathStack.length - 1]; openModal('sub-modal'); }
async function handleCreateSub(e) {
	e.preventDefault();
	const id = 'n_' + Date.now();
	const node = { id, parentId: targetPid, title: document.getElementById('sub-title').value.trim(), desc: document.getElementById('sub-desc').value.trim(), icon: '📁', order: Date.now() };
	db.nodes[id] = node; closeModal('sub-modal'); e.target.reset(); renderExplorer();
	await api(`nodes/${id}`, 'PUT', node); showToast('Вкладка сохранена в базу!');
}

function openSubtabModal() { openModal('subtab-modal'); }
async function handleCreateSubtab(e) {
	e.preventDefault();
	const id = 'st_' + Date.now(), nid = pathStack[pathStack.length - 1];
	const st = { id, nodeId: nid, title: document.getElementById('st-title').value.trim(), text: document.getElementById('st-body').value.trim(), author: currentUser ? currentUser.username : 'Администрация', closed: false, created: Date.now() };
	db.subtabs[id] = st; closeModal('subtab-modal'); e.target.reset(); renderExplorer();
	await api(`subtabs/${id}`, 'PUT', st); showToast('Подвкладка создана!');
}

function openSubtab(id) {
	const st = db.subtabs[id]; if (!st) return;
	activeSubtabId = id;
	document.getElementById('subtab-breadcrumb').innerText = pathStack.map(x => x === 'root' ? 'Главная' : db.nodes[x]?.title).join(' / ') + ' / ' + st.title;
	document.getElementById('subtab-view-title').innerText = (st.closed ? '🔒 ' : '') + st.title;
	document.getElementById('subtab-view-body').innerHTML = st.text.replace(/\n/g, '<br>');
	updateSubtabLockUI(); renderSubtabPosts(); showTab('subtab');
}

function updateSubtabLockUI() {
	const st = db.subtabs[activeSubtabId]; if (!st) return;
	const isClosed = !!st.closed;
	document.getElementById('subtab-view-title').innerText = (isClosed ? '🔒 ' : '') + st.title;
	document.getElementById('subtab-reply-section').style.display = isClosed ? 'none' : 'block';
	document.getElementById('subtab-closed-notice').style.display = isClosed ? 'block' : 'none';
	const canManage = currentUser && (getUserRole(currentUser).key !== 'player' || st.author === currentUser.username);
	const btn = document.getElementById('btn-toggle-subtab');
	btn.style.display = canManage ? 'inline-block' : 'none';
	btn.innerText = isClosed ? '🔓 Открыть подвкладку' : '🔒 Закрыть подвкладку';
}

async function toggleSubtabLock() {
	const st = db.subtabs[activeSubtabId]; if (!st) return;
	st.closed = !st.closed; updateSubtabLockUI();
	await api(`subtabs/${activeSubtabId}`, 'PUT', st);
	showToast(st.closed ? 'Подвкладка закрыта!' : 'Подвкладка снова открыта!');
}

function renderSubtabPosts() {
	const list = getPosts(activeSubtabId);
	document.getElementById('subtab-replies-block').style.display = list.length ? 'block' : 'none';
	document.getElementById('subtab-posts-container').innerHTML = list.map(p => {
		const r = getUserRole(db.users[safeKey(p.author)]);
		return `<div class="post-item"><div class="post-author"><div class="avatar neon-pink">${p.author.charAt(0).toUpperCase()}</div><div class="staff-name r-${r.key}">${p.author}</div><div class="role-badge r-${r.key}">${r.label}</div></div><div class="post-content"><div class="post-date">${p.time}</div><p>${p.text.replace(/\n/g, '<br>')}</p></div></div>`;
	}).join('');
}

async function submitSubtabReply() {
	if (!currentUser) { openModal('login-modal'); return showToast('Войдите в аккаунт'); }
	const st = db.subtabs[activeSubtabId]; if (st && st.closed) return showToast('Подвкладка закрыта!');
	const inp = document.getElementById('subtab-reply-text'); if (!inp.value.trim()) return;
	const now = Date.now(), pid = 'p_' + now, time = 'Сегодня в ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	const post = { id: pid, topicId: activeSubtabId, author: currentUser.username, text: inp.value.trim(), time, created: now };
	db.posts[pid] = post; inp.value = ''; renderSubtabPosts();
	await api(`posts/${pid}`, 'PUT', post); showToast('Ответ отправлен!');
}
function closeSubtab() { activeSubtabId = null; showTab('forums'); renderExplorer(); }
