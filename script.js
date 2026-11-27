const DB_URL = 'https://firebaseio.com';

let currentUser = JSON.parse(localStorage.getItem('neon_user')) || null;
let usersList = [];
let pathStack = ['root'];
let activeTopic = null;

const defaultTree = {
	id: 'root', title: 'Главная', children: [
		{ id: 'cat_main', title: '⚡ Основной раздел', children: [
			{ id: 'news', title: 'Новости и обновления проекта', desc: 'Актуальная информация и патчи.', icon: '📢', children: [], topics: [] },
			{ id: 'rules', title: 'Правила проекта', desc: 'Общие правила серверов и форума.', icon: '📜', children: [], topics: [] }
		], topics: [] },
		{ id: 'cat_srv', title: '🌐 Игровые серверы', children: [
			{ id: 's1', title: 'Сервер №1 | CYBER', desc: 'Разделы первого сервера.', icon: '01', children: [
				{ id: 's1_gos', title: 'Государственные организации', desc: 'ФСБ, УМВД, ГИБДД, Армия, Правительство.', icon: '🏛️', children: [
					{ id: 's1_fsb', title: 'ФСБ', desc: 'Федеральная служба безопасности.', icon: '🛡️', children: [], topics: [] }
				], topics: [] },
				{ id: 's1_opg', title: 'Криминальные организации', desc: 'Арзамасская, Батыревская, Лыткаринская ОПГ.', icon: '🔫', children: [], topics: [] },
				{ id: 's1_jb', title: 'Жалобы', desc: 'Жалобы на игроков, лидеров и администрацию.', icon: '⚖️', children: [], topics: [] }
			], topics: [] },
			{ id: 's2', title: 'Сервер №2 | SYNTH', desc: 'Разделы второго сервера.', icon: '02', children: [], topics: [] }
		], topics: [] }
	], topics: []
};
let tree = defaultTree;

async function syncCloud() {
	try {
		const res = await fetch(`${DB_URL}/forum.json`);
		const data = await res.json();
		if (data && data.tree) tree = data.tree;
		if (data && data.users) usersList = Object.values(data.users).filter(Boolean);
		if (currentUser && !usersList.includes(currentUser.username)) {
			await saveUserCloud(currentUser.username);
		}
		refreshCurrentView();
	} catch (e) { console.error(e); }
}

async function saveCloud() {
	await fetch(`${DB_URL}/forum/tree.json`, { method: 'PUT', body: JSON.stringify(tree) });
}

async function saveUserCloud(u) {
	const key = u.replace(/[.#$\[\]\/]/g, '_');
	await fetch(`${DB_URL}/forum/users/${key}.json`, { method: 'PUT', body: JSON.stringify(u) });
	if (!usersList.includes(u)) usersList.push(u);
}

function refreshCurrentView() {
	if (document.getElementById('tab-forums').style.display !== 'none') renderExplorer();
	if (document.getElementById('tab-users').style.display !== 'none') renderUsers();
	if (document.getElementById('tab-new').style.display !== 'none') renderNew();
	if (document.getElementById('tab-topic').style.display !== 'none' && activeTopic) {
		const cur = findNode(pathStack[pathStack.length - 1]);
		activeTopic = (cur.topics || []).find(t => t.id === activeTopic.id);
		if (activeTopic) renderPosts();
	}
}

function findNode(id, node = tree) {
	if (node.id === id) return node;
	for (let c of (node.children || [])) { const f = findNode(id, c); if (f) return f; }
	return null;
}

function countStats(node) {
	let t = (node.topics || []).length, p = (node.topics || []).reduce((s, top) => s + (top.posts || []).length, 0);
	for (let c of (node.children || [])) { const sub = countStats(c); t += sub.t; p += sub.p; }
	return { t, p };
}
function renderExplorer() {
	const cur = findNode(pathStack[pathStack.length - 1]) || tree;
	document.getElementById('btn-back').style.display = pathStack.length > 1 ? 'inline-block' : 'none';
	document.getElementById('btn-new-topic').style.display = pathStack.length > 1 ? 'inline-block' : 'none';
	document.getElementById('breadcrumbs').innerHTML = pathStack.map((id, idx) => `<span style="cursor:pointer; color:${idx === pathStack.length - 1 ? '#fff' : 'var(--muted)'}" onclick="jumpTo(${idx})">${findNode(id).title}</span>`).join(' / ');

	let html = pathStack.length === 1
		? (cur.children || []).map(cat => `<section class="category-block"><div class="category-header" style="display:flex; justify-content:space-between; align-items:center;"><h2>${cat.title}</h2><button class="btn btn-login" style="padding:4px 10px; font-size:11px;" onclick="openSubModal('${cat.id}')">+ Подраздел</button></div><div class="forum-list">${renderNodeItems(cat.children || [])}</div></section>`).join('')
		: ((cur.children || []).length ? `<section class="category-block"><div class="category-header"><h2>📁 Подразделы: ${cur.title}</h2></div><div class="forum-list">${renderNodeItems(cur.children)}</div></section>` : '') +
		`<section class="category-block"><div class="category-header"><h2>💬 Темы раздела</h2></div><div class="forum-list">${(cur.topics || []).length ? cur.topics.map(top => `<div class="forum-item" onclick="openTopic('${top.id}')"><div class="forum-icon unread">💬</div><div class="forum-info"><span class="forum-title">${top.title}</span><p class="forum-desc">Автор: ${top.author}</p></div><div class="forum-stats"><div><span>${top.posts.length}</span> сообщ.</div></div><div class="forum-last-post"><span class="last-post-title">${top.posts[top.posts.length - 1].author}</span><div class="last-post-meta">${top.posts[top.posts.length - 1].time}</div></div></div>`).join('') : `<div class="widget-body" style="color:var(--muted); font-size:13px;">Тем пока нет. Нажмите «+ Тема» или «+ Подраздел»!</div>`}</div></section>`;
	document.getElementById('explorer-content').innerHTML = html;
}

function renderNodeItems(items) {
	if (!items.length) return `<div class="widget-body" style="color:var(--muted); font-size:13px;">Пусто. Создайте первый подраздел!</div>`;
	return items.map(it => {
		const st = countStats(it), subs = (it.children || []).length ? `<div class="sub-tags">${it.children.map(s => `<span class="sub-tag">📁 ${s.title}</span>`).join('')}</div>` : '';
		return `<div class="forum-item" onclick="openNode('${it.id}')"><div class="forum-icon ${(it.children || []).length ? 'unread' : ''}">${it.icon || '📁'}</div><div class="forum-info"><span class="forum-title">${it.title}</span><p class="forum-desc">${it.desc || 'Подраздел'}</p>${subs}</div><div class="forum-stats"><div><span>${st.t}</span> тем</div><div><span>${st.p}</span> сообщ.</div></div><div class="forum-last-post"><div class="last-post-meta">${(it.children || []).length ? 'Подразделов: ' + it.children.length : 'Открыть →'}</div></div></div>`;
	}).join('');
}

function openNode(id) { pathStack.push(id); showTab('forums'); renderExplorer(); }
function jumpTo(idx) { pathStack = pathStack.slice(0, idx + 1); showTab('forums'); renderExplorer(); }
function goBack() { if (pathStack.length > 1) { pathStack.pop(); renderExplorer(); } }
function goHome() { pathStack = ['root']; showTab('forums'); renderExplorer(); }

let targetParentId = null;
function openSubModal(pid = null) { targetParentId = pid || pathStack[pathStack.length - 1]; openModal('sub-modal'); }
async function handleCreateSub(e) {
	e.preventDefault(); const p = findNode(targetParentId); p.children = p.children || [];
	p.children.push({ id: 'n_' + Date.now(), title: document.getElementById('sub-title').value.trim(), desc: document.getElementById('sub-desc').value.trim(), icon: '📁', children: [], topics: [] });
	closeModal('sub-modal'); e.target.reset(); renderExplorer(); await saveCloud(); showToast('Подраздел сохранён в облако!');
}

function openTopicModal() { if (!currentUser) { openModal('login-modal'); return showToast('Войдите в аккаунт'); } openModal('topic-modal'); }
async function handleCreateTopic(e) {
	e.preventDefault(); const cur = findNode(pathStack[pathStack.length - 1]); cur.topics = cur.topics || [];
	const time = 'Сегодня в ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	cur.topics.unshift({ id: 't_' + Date.now(), title: document.getElementById('top-title').value.trim(), author: currentUser.username, posts: [{ author: currentUser.username, text: document.getElementById('top-body').value.trim(), time }] });
	closeModal('topic-modal'); e.target.reset(); renderExplorer(); await saveCloud(); showToast('Тема опубликована для всех!');
}

function openTopic(tid) {
	activeTopic = (findNode(pathStack[pathStack.length - 1]).topics || []).find(t => t.id === tid);
	document.getElementById('topic-breadcrumb').innerText = pathStack.map(id => findNode(id).title).join(' / ') + ' / ' + activeTopic.title;
	document.getElementById('topic-view-title').innerText = activeTopic.title; renderPosts(); showTab('topic');
}
function renderPosts() { document.getElementById('topic-posts-container').innerHTML = activeTopic.posts.map(p => `<div class="post-item"><div class="post-author"><div class="avatar neon-pink">${p.author.charAt(0).toUpperCase()}</div><div class="staff-name">${p.author}</div><div class="role-badge">Игрок</div></div><div class="post-content"><div class="post-date">${p.time}</div><p>${p.text.replace(/\n/g, '<br>')}</p></div></div>`).join(''); }
async function submitReply() {
	if (!currentUser) { openModal('login-modal'); return showToast('Войдите в аккаунт'); }
	const inp = document.getElementById('reply-text'); if (!inp.value.trim()) return;
	activeTopic.posts.push({ author: currentUser.username, text: inp.value.trim(), time: 'Сегодня в ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
	inp.value = ''; renderPosts(); await saveCloud(); showToast('Ответ отправлен!');
}
function closeTopic() { showTab('forums'); renderExplorer(); }

function showTab(t) { ['forums', 'new', 'users', 'topic'].forEach(id => document.getElementById('tab-' + id).style.display = (id === t) ? 'block' : 'none'); document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active')); if (document.getElementById('nav-' + t)) document.getElementById('nav-' + t).classList.add('active'); refreshCurrentView(); }
function renderUsers() { document.getElementById('users-directory').innerHTML = usersList.length ? usersList.map(u => `<div class="user-card-row"><div class="avatar neon-pink">${u.charAt(0).toUpperCase()}</div><div><div class="staff-name">${u}</div><div class="staff-role">Участник</div></div></div>`).join('') : `<div style="color:var(--muted); font-size:13px;">Пока нет участников.</div>`; }
function renderNew() { let all = []; const col = n => { (n.topics || []).forEach(top => all.push({ top, sec: n.title })); (n.children || []).forEach(col); }; col(tree); document.getElementById('whats-new-list').innerHTML = all.length ? all.map(x => `<div class="forum-item"><div class="forum-icon unread">🆕</div><div class="forum-info"><span class="forum-title">${x.top.title}</span><p class="forum-desc">Автор: ${x.top.author} • ${x.sec}</p></div></div>`).join('') : `<div class="widget-body" style="color:var(--muted); font-size:13px;">Тем пока нет.</div>`; }

function updateAuthUI() { document.getElementById('auth-area').innerHTML = currentUser ? `<div class="user-badge"><span class="user-dot"></span><span>${currentUser.username}</span></div><button class="btn btn-login" onclick="logout()">Выйти</button>` : `<button class="btn btn-login" onclick="openModal('login-modal')">Вход</button><button class="btn btn-register" onclick="openModal('register-modal')">Регистрация</button>`; }
async function authUser(u) { currentUser = { username: u }; localStorage.setItem('neon_user', JSON.stringify(currentUser)); await saveUserCloud(u); updateAuthUI(); refreshCurrentView(); }
function handleRegister(e) { e.preventDefault(); const u = document.getElementById('reg-username').value.trim(); authUser(u); closeModal('register-modal'); showToast('Аккаунт ' + u + ' создан!'); }
function handleLogin(e) { e.preventDefault(); const u = document.getElementById('login-username').value.trim(); authUser(u); closeModal('login-modal'); showToast('Вы вошли как ' + u); }
function logout() { localStorage.removeItem('neon_user'); currentUser = null; updateAuthUI(); }
function initModals() {
	document.getElementById('modals-container').innerHTML = `
		<div class="modal-overlay" id="register-modal"><div class="modal-box">
			<div class="modal-header"><h3>Регистрация</h3><button class="modal-close" onclick="closeModal('register-modal')">×</button></div>
			<form onsubmit="handleRegister(event)">
				<label class="input-label">Никнейм</label><input type="text" id="reg-username" class="neon-input" required>
				<label class="input-label">Пароль</label><input type="password" class="neon-input" required>
				<button type="submit" class="btn btn-register full-width">Создать</button>
			</form>
		</div></div>
		<div class="modal-overlay" id="login-modal"><div class="modal-box">
			<div class="modal-header"><h3>Вход</h3><button class="modal-close" onclick="closeModal('login-modal')">×</button></div>
			<form onsubmit="handleLogin(event)">
				<label class="input-label">Никнейм</label><input type="text" id="login-username" class="neon-input" required>
				<label class="input-label">Пароль</label><input type="password" class="neon-input" required>
				<button type="submit" class="btn btn-register full-width">Войти</button>
			</form>
		</div></div>
		<div class="modal-overlay" id="sub-modal"><div class="modal-box">
			<div class="modal-header"><h3>Новый подраздел</h3><button class="modal-close" onclick="closeModal('sub-modal')">×</button></div>
			<form onsubmit="handleCreateSub(event)">
				<label class="input-label">Название</label><input type="text" id="sub-title" class="neon-input" required>
				<label class="input-label">Описание</label><input type="text" id="sub-desc" class="neon-input">
				<button type="submit" class="btn btn-register full-width">Создать</button>
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
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showToast(msg) { const t = document.getElementById('toast'); t.innerText = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }

initModals();
updateAuthUI();
renderExplorer();
syncCloud();
setInterval(syncCloud, 4000);
