let currentUser = JSON.parse(localStorage.getItem('neon_user')) || null;

const categoriesData = [
	{
		title: '⚡ Основной раздел',
		items: [
			{ id: 'news', icon: '📢', cls: '', name: 'Новости и обновления проекта', desc: 'Актуальная информация о разработке, патчах и глобальных событиях.' },
			{ id: 'rules', icon: '📜', cls: '', name: 'Правила проекта', desc: 'Общие правила серверов, форума, лидеров и администрации.' }
		]
	},
	{
		title: '🌐 Игровые серверы',
		items: [
			{ id: 's1', icon: '01', cls: 'server-1', name: 'Сервер №1 | CYBER', desc: 'Жалобы, заявки на пост лидера, государственные и криминальные организации.' },
			{ id: 's2', icon: '02', cls: 'server-2', name: 'Сервер №2 | SYNTH', desc: 'Жалобы, заявки на пост лидера, государственные и криминальные организации.' }
		]
	},
	{
		title: '🛠️ Технический раздел',
		items: [
			{ id: 'tech', icon: '🐞', cls: '', name: 'Сообщить о баге или недоработке', desc: 'Проблемы с лаунчером, пропажа имущества, баги игрового мода.' }
		]
	}
];

const counters = { news: 0, rules: 0, s1: 0, s2: 0, tech: 0 };
const sectionNames = { news: 'Новости и обновления проекта', rules: 'Правила проекта', s1: 'Сервер №1 | CYBER', s2: 'Сервер №2 | SYNTH', tech: 'Технический раздел' };

function initLayout() {
	document.getElementById('categories-container').innerHTML = categoriesData.map(cat => `
		<section class="category-block">
			<div class="category-header"><h2>${cat.title}</h2></div>
			<div class="forum-list">
				${cat.items.map(it => `
					<div class="forum-item" onclick="showToast('В разделе «${it.name}» пока 0 тем. Нажмите «+ Создать тему»!')">
						<div class="forum-icon ${it.cls}">${it.icon}</div>
						<div class="forum-info"><span class="forum-title">${it.name}</span><p class="forum-desc">${it.desc}</p></div>
						<div class="forum-stats"><div><span id="stat-t-${it.id}">0</span> тем</div><div><span id="stat-p-${it.id}">0</span> сообщ.</div></div>
						<div class="forum-last-post" id="last-${it.id}"><div class="last-post-meta">Нет сообщений</div></div>
					</div>
				`).join('')}
			</div>
		</section>
	`).join('');

	document.getElementById('modals-container').innerHTML = `
		<div class="modal-overlay" id="register-modal"><div class="modal-box">
			<div class="modal-header"><h3>Регистрация на NEON RUSSIA</h3><button class="modal-close" onclick="closeModal('register-modal')">×</button></div>
			<form onsubmit="handleRegister(event)">
				<label class="input-label">Игровой никнейм (Nick_Name)</label><input type="text" id="reg-username" class="neon-input" placeholder="Ivan_Neon" required>
				<label class="input-label">Электронная почта</label><input type="email" id="reg-email" class="neon-input" placeholder="example@mail.ru" required>
				<label class="input-label">Пароль</label><input type="password" id="reg-password" class="neon-input" placeholder="Пароль" required>
				<button type="submit" class="btn btn-register full-width">Создать аккаунт</button>
			</form>
		</div></div>
		<div class="modal-overlay" id="login-modal"><div class="modal-box">
			<div class="modal-header"><h3>Вход в аккаунт</h3><button class="modal-close" onclick="closeModal('login-modal')">×</button></div>
			<form onsubmit="handleLogin(event)">
				<label class="input-label">Ваш никнейм</label><input type="text" id="login-username" class="neon-input" placeholder="Ваш ник" required>
				<label class="input-label">Пароль</label><input type="password" id="login-password" class="neon-input" placeholder="Пароль" required>
				<button type="submit" class="btn btn-register full-width">Войти на форум</button>
			</form>
		</div></div>
		<div class="modal-overlay" id="topic-modal"><div class="modal-box">
			<div class="modal-header"><h3>Создать новую тему</h3><button class="modal-close" onclick="closeModal('topic-modal')">×</button></div>
			<form onsubmit="handleCreateTopic(event)">
				<label class="input-label">Раздел</label>
				<select id="new-topic-section" class="neon-input">
					<option value="news">Новости и обновления проекта</option><option value="rules">Правила проекта</option>
					<option value="s1">Сервер №1 | CYBER</option><option value="s2">Сервер №2 | SYNTH</option><option value="tech">Технический раздел</option>
				</select>
				<label class="input-label">Заголовок темы</label><input type="text" id="new-topic-title" class="neon-input" placeholder="Заголовок" required>
				<label class="input-label">Текст сообщения</label><textarea id="new-topic-body" class="neon-input" rows="4" placeholder="Текст..." required></textarea>
				<button type="submit" class="btn btn-register full-width">Опубликовать тему</button>
			</form>
		</div></div>
	`;
}

function updateAuthUI() {
	document.getElementById('auth-area').innerHTML = currentUser
		? `<div class="user-badge"><span class="user-dot"></span><span>${currentUser.username}</span></div><button class="btn btn-login" onclick="logout()">Выйти</button>`
		: `<button class="btn btn-login" onclick="openModal('login-modal')">Вход</button><button class="btn btn-register" onclick="openModal('register-modal')">Регистрация</button>`;
}

function handleRegister(e) {
	e.preventDefault();
	const username = document.getElementById('reg-username').value.trim();
	currentUser = { username, email: document.getElementById('reg-email').value.trim(), role: 'Игрок' };
	localStorage.setItem('neon_user', JSON.stringify(currentUser));
	document.getElementById('users-directory').innerHTML += `<div class="user-card-row"><div class="avatar neon-pink">${username.charAt(0).toUpperCase()}</div><div><div class="staff-name">${username}</div><div class="staff-role">Участник • Зарегистрирован только что</div></div></div>`;
	closeModal('register-modal'); updateAuthUI(); showToast('Аккаунт ' + username + ' создан!');
}

function handleLogin(e) {
	e.preventDefault();
	const username = document.getElementById('login-username').value.trim();
	currentUser = { username, role: 'Игрок' };
	localStorage.setItem('neon_user', JSON.stringify(currentUser));
	closeModal('login-modal'); updateAuthUI(); showToast('Вы вошли как ' + username);
}

function logout() { localStorage.removeItem('neon_user'); currentUser = null; updateAuthUI(); showToast('Вы вышли из аккаунта'); }

function showView(v) {
	['forums', 'new', 'users', 'topic'].forEach(id => document.getElementById('view-' + id).style.display = (id === v) ? 'block' : 'none');
	document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
	if (document.getElementById('nav-' + v)) document.getElementById('nav-' + v).classList.add('active');
}

function openTopic(sec, title, author, text, time) {
	document.getElementById('topic-breadcrumb').innerText = `Форумы / ${sec} / ${title}`;
	document.getElementById('topic-view-title').innerText = title;
	document.getElementById('topic-posts-container').innerHTML = `<div class="post-item"><div class="post-author"><div class="avatar neon-pink">${author.charAt(0).toUpperCase()}</div><div class="staff-name">${author}</div><div class="role-badge">Игрок</div></div><div class="post-content"><div class="post-date">${time}</div><p>${text.replace(/\n/g, '<br>')}</p></div></div>`;
	showView('topic'); window.scrollTo(0, 0);
}

function submitReply() {
	if (!currentUser) { openModal('login-modal'); return showToast('Войдите в аккаунт'); }
	const inp = document.getElementById('reply-text');
	if (!inp.value.trim()) return;
	const time = 'Сегодня в ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	document.getElementById('topic-posts-container').innerHTML += `<div class="post-item"><div class="post-author"><div class="avatar neon-cyan">${currentUser.username.charAt(0).toUpperCase()}</div><div class="staff-name">${currentUser.username}</div><div class="role-badge">Игрок</div></div><div class="post-content"><div class="post-date">${time}</div><p>${inp.value.trim().replace(/\n/g, '<br>')}</p></div></div>`;
	inp.value = ''; showToast('Ответ опубликован!');
}

function openNewTopicModal() {
	if (!currentUser) { openModal('login-modal'); return showToast('Войдите в аккаунт'); }
	openModal('topic-modal');
}

function handleCreateTopic(e) {
	e.preventDefault();
	const key = document.getElementById('new-topic-section').value;
	const sec = sectionNames[key];
	const title = document.getElementById('new-topic-title').value.trim();
	const body = document.getElementById('new-topic-body').value.trim();
	const time = 'Сегодня в ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

	counters[key] += 1;
	document.getElementById('stat-t-' + key).innerText = counters[key];
	document.getElementById('stat-p-' + key).innerText = counters[key];
	document.getElementById('last-' + key).innerHTML = `<span class="last-post-title">${title}</span><div class="last-post-meta">${time} • <span class="role-user">${currentUser.username}</span></div>`;

	document.getElementById('user-topics-block').style.display = 'block';
	const item = document.createElement('div');
	item.className = 'forum-item';
	item.onclick = () => openTopic(sec, title, currentUser.username, body, time);
	item.innerHTML = `<div class="forum-icon unread">💬</div><div class="forum-info"><span class="forum-title">${title}</span><p class="forum-desc">Раздел: ${sec}</p></div><div class="forum-stats"><div><span>1</span> тема</div><div><span>1</span> сообщ.</div></div><div class="forum-last-post"><span class="last-post-title">${title}</span><div class="last-post-meta">${time} • ${currentUser.username}</div></div>`;
	document.getElementById('custom-topics-list').prepend(item);

	if (document.getElementById('empty-new-msg')) document.getElementById('empty-new-msg').remove();
	const act = document.createElement('div');
	act.className = 'forum-item';
	act.onclick = () => openTopic(sec, title, currentUser.username, body, time);
  	act.innerHTML = `
		<div class="forum-icon unread">🆕</div>
		<div class="forum-info">
			<span class="forum-title">${title}</span>
			<p class="forum-desc">Автор: ${currentUser.username} • ${sec}</p>
		</div>
		<div class="forum-stats">
			<div><span>${time}</span></div>
		</div>
		<div class="forum-last-post">
			<span class="last-post-title">Открыть тему →</span>
		</div>
	`;
	document.getElementById('whats-new-list').prepend(act);

	closeModal('topic-modal');
	e.target.reset();
	showToast('Тема опубликована!');
}

function openModal(id) {
	document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
	document.getElementById(id).style.display = 'none';
}

function showToast(msg) {
	const t = document.getElementById('toast');
	t.innerText = msg;
	t.classList.add('show');
	setTimeout(() => t.classList.remove('show'), 3000);
}

initLayout();
updateAuthUI();
