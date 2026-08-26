const SUPABASE_URL = 'https://umivscssqnnbtfrsoffz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaXZzY3NzcW5uYnRmcnNvZmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTU2NjksImV4cCI6MjEwMzIzMTY2OX0.6XcRJC1BnBWIL5ReFy1IFIqxGpExtGlnlX-PHNEFJ0s';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null, saveTimeout = null;
const STORAGE_KEY = 'reviso-study-data-v1';
const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname) || location.protocol === 'file:';
const templates = {
  CAT: ['Arithmetic & Algebra', 'Geometry & Mensuration', 'Reading comprehension', 'Logical reasoning', 'Data interpretation'],
  GMAT: ['Quantitative reasoning', 'Verbal reasoning', 'Data insights', 'Critical reasoning'],
  'GATE Chemical': ['Process calculations', 'Thermodynamics', 'Fluid mechanics', 'Heat transfer', 'Mass transfer', 'Reaction engineering'],
  'CFA Level I': ['Ethics', 'Quantitative methods', 'Financial statement analysis', 'Equity', 'Fixed income', 'Portfolio management'],
  'CFA Level II': ['Ethics', 'Financial statement analysis', 'Equity valuation', 'Fixed income', 'Derivatives', 'Portfolio management'],
  'CFA Level III': ['Ethics', 'Asset allocation', 'Portfolio construction', 'Fixed income', 'Equity', 'Performance evaluation'],
  'System Design': ['Requirements & estimation', 'Databases & caching', 'Networking & APIs', 'Distributed systems', 'Low-level design', 'Mock interviews']
};
const dayMs = 86400000;
const iso = (date = new Date()) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (date, days) => { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; };
const daysBetween = (a, b) => Math.max(0, Math.ceil((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / dayMs));
const formatDate = date => new Intl.DateTimeFormat('en', {weekday:'short', month:'short', day:'numeric'}).format(new Date(date + 'T12:00'));
const uid = () => Math.random().toString(36).slice(2, 10);
const escapeHTML = text => String(text).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function createDefaultAvailability(hours=8) { const availability={0:0,1:0,2:0,3:0,4:0,5:0,6:0}; let remaining=Number(hours)||8; for(const day of [1,2,3,4,5,6]){const allotted=Math.min(2,remaining);availability[day]=allotted;remaining-=allotted;if(remaining<=0)break;}return availability; }
function availabilityHours(exam) { return Object.values(exam.availability||{}).reduce((total,hours)=>total+(Number(hours)||0),0); }
function minutesAvailableOn(exam, date) { return (Number(exam.availability?.[new Date(date+'T12:00').getDay()])||0)*60; }

function starterData() {
  const now = new Date();
  const tomorrow = iso(addDays(now, 1));
  return { theme:'night', ai: { provider: 'gemini', keys: { gemini: '', openai: '', claude: '' } }, activeExamId:'cat', tutorialCompleted: false, exams:[{id:'cat',name:'CAT 2026', template:'CAT', examDate:iso(addDays(now, 105)), weeklyHours:12,
    topics:templates.CAT.map((name, i) => ({id:uid(),name,confidence:[2,1,2,1,1][i],completed:0,concepts:[]})),
    tasks:[{id:uid(),date:iso(now),topic:'Arithmetic & Algebra',type:'Learn',duration:45,done:false},{id:uid(),date:iso(now),topic:'Reading comprehension',type:'Active recall',duration:30,done:false},{id:uid(),date:tomorrow,topic:'Data interpretation',type:'Practice',duration:45,done:false}],
    cards:[{id:uid(),front:'What does a negative slope tell you?',back:'As x rises, y falls. The magnitude shows the decrease in y for each one-unit increase in x.',topic:'Arithmetic & Algebra',due:iso(now),reviews:2,ease:2.5,interval:1,repetition:1},{id:uid(),front:'Before choosing an answer in RC, what must your evidence do?',back:'Point to a specific line or inference supported by the passage - not just a plausible-sounding interpretation.',topic:'Reading comprehension',due:iso(now),reviews:0,ease:2.5,interval:0,repetition:0},{id:uid(),front:'What makes a set solvable using a Venn diagram?',back:'The categories overlap and the question concerns counts in individual groups, intersections, or neither.',topic:'Logical reasoning',due:tomorrow,reviews:1,ease:2.5,interval:1,repetition:1}],
    mistakes:[{id:uid(),topic:'Arithmetic & Algebra',question:'Ratio problem: mixed up part-to-whole with part-to-part.',correct:'Set the total as the common denominator before comparing parts.',why:'Rushed the setup and converted the given ratio incorrectly.',created:iso(addDays(now,-2))}]
  }]};
}
let state;
try { state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || starterData(); } catch { state = starterData(); }
if (!state.ai) state.ai = { provider: 'gemini', keys: { gemini: '', openai: '', claude: '' } };
state.exams.forEach(exam => exam.mistakes.forEach(mistake => {
  const linkedCard = exam.cards.find(card => card.mistakeId === mistake.id || card.front === `Mistake check: ${mistake.question}`);
  if (linkedCard) linkedCard.mistakeId = mistake.id;
}));
state.exams.forEach(exam => { delete exam.sessionLength; });
state.exams.forEach(exam => { exam.cards.forEach(c => { if(c.ease===undefined) { c.ease=2.5; c.repetition=c.streak||0; c.interval=c.repetition>0?(c.repetition===1?1:6):0; delete c.streak; } }); });
state.exams.forEach(exam => { if (!exam.availability) exam.availability = createDefaultAvailability(exam.weeklyHours); exam.weeklyHours=availabilityHours(exam); });
state.timer ||= {focus:25, break:5};
let timerMode='focus', timerRemaining=state.timer.focus*60, timerInterval=null;
const $ = s => document.querySelector(s);
const currentExam = () => state.exams.find(x => x.id === state.activeExamId) || state.exams[0];
function save() { 
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); 
  if(currentUser) { 
    clearTimeout(saveTimeout); 
    saveTimeout = setTimeout(() => {
      const cloudState = JSON.parse(JSON.stringify(state));
      cloudState.ai.keys = { gemini: '', openai: '', claude: '' };
      supabaseClient.from('study_data').upsert({id:currentUser.id, state: cloudState});
    }, 1500); 
  }
}
async function loadFromCloud() {
  if(!currentUser)return;
  const { data, error } = await supabaseClient.from('study_data').select('state').eq('id', currentUser.id).maybeSingle();
  if (data?.state && Object.keys(data.state).length) {
    const localKeys = state.ai?.keys || { gemini: '', openai: '', claude: '' };
    state = data.state;
    if (!state.ai) state.ai = { provider: 'gemini', keys: localKeys };
    else state.ai.keys = localKeys;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    state.exams.forEach(exam => exam.mistakes.forEach(mistake => {
      const linkedCard = exam.cards.find(card => card.mistakeId === mistake.id || card.front === `Mistake check: ${mistake.question}`);
      if (linkedCard) linkedCard.mistakeId = mistake.id;
    }));
    state.exams.forEach(exam => { exam.cards.forEach(c => { if(c.ease===undefined) { c.ease=2.5; c.repetition=c.streak||0; c.interval=c.repetition>0?(c.repetition===1?1:6):0; delete c.streak; } }); });
    state.exams.forEach(exam => { if (!exam.availability) exam.availability = createDefaultAvailability(exam.weeklyHours); exam.weeklyHours=availabilityHours(exam); });
    state.timer ||= {focus:25, break:5};
  } else {
    supabaseClient.from('study_data').upsert({id:currentUser.id, state});
  }
  renderAll();
}
supabaseClient.auth.getSession().then(({ data: { session } }) => {
  if(session) { 
    currentUser = session.user; 
    if($('#auth-dialog').open) $('#auth-dialog').close(); 
    $('#login-nav-button').classList.add('hidden'); 
    $('#logout-button').classList.remove('hidden');
    $('#mobile-login-button').classList.add('hidden'); 
    $('#mobile-logout-button').classList.remove('hidden'); 
    loadFromCloud();
  }
  else { 
    currentUser = null; 
    if(!$('#auth-dialog').open) $('#auth-dialog').showModal(); 
    $('#login-nav-button').classList.remove('hidden'); 
    $('#logout-button').classList.add('hidden');
    $('#mobile-login-button').classList.remove('hidden'); 
    $('#mobile-logout-button').classList.add('hidden'); 
  }
});
supabaseClient.auth.onAuthStateChange((event, session) => {
  if(session) { 
    currentUser = session.user; 
    if($('#auth-dialog').open) $('#auth-dialog').close(); 
    $('#login-nav-button').classList.add('hidden'); 
    $('#logout-button').classList.remove('hidden'); 
    $('#mobile-login-button').classList.add('hidden'); 
    $('#mobile-logout-button').classList.remove('hidden'); 
    loadFromCloud(); 
  }
  else { 
    currentUser = null; 
    $('#login-nav-button').classList.remove('hidden'); 
    $('#logout-button').classList.add('hidden'); 
    $('#mobile-login-button').classList.remove('hidden'); 
    $('#mobile-logout-button').classList.add('hidden'); 
  }
});
$('#auth-skip-btn').addEventListener('click', () => { 
  if($('#auth-dialog').open) $('#auth-dialog').close(); 
  if(!state.tutorialCompleted) openTutorial();
});
$('#login-nav-button').addEventListener('click', () => { if(!$('#auth-dialog').open) $('#auth-dialog').showModal(); });
$('#settings-nav-button').addEventListener('click', () => { 
  $('#settings-ai-provider').value = state.ai.provider;
  $('#settings-key-gemini').value = state.ai.keys.gemini || '';
  $('#settings-key-openai').value = state.ai.keys.openai || '';
  $('#settings-key-claude').value = state.ai.keys.claude || '';
  if (!isLocal) {
    $('#settings-ai-provider').disabled = true;
    $('#settings-key-gemini').disabled = true;
    $('#settings-key-openai').disabled = true;
    $('#settings-key-claude').disabled = true;
    $('#ai-local-warning').classList.remove('hidden');
  } else {
    $('#ai-local-warning').classList.add('hidden');
  }
  $('#settings-ai-provider').dispatchEvent(new Event('change'));
  $('#settings-dialog').showModal(); 
});
$('#settings-ai-provider').addEventListener('change', e => {
  ['gemini', 'openai', 'claude'].forEach(p => {
    document.querySelector(`[data-provider="${p}"]`).classList.toggle('hidden', e.target.value !== p);
  });
});
$('#settings-cancel').addEventListener('click', () => $('#settings-dialog').close());
$('#settings-form').addEventListener('submit', e => {
  e.preventDefault();
  state.ai.provider = $('#settings-ai-provider').value;
  state.ai.keys.gemini = $('#settings-key-gemini').value.trim();
  state.ai.keys.openai = $('#settings-key-openai').value.trim();
  state.ai.keys.claude = $('#settings-key-claude').value.trim();
  save(); $('#settings-dialog').close(); toast('Settings saved.');
});

$('#auth-form').addEventListener('submit', async e => {
  e.preventDefault(); const email=$('#auth-email').value, password=$('#auth-password').value, err=$('#auth-error'); err.classList.add('hidden');
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if(error){ err.textContent=error.message; err.classList.remove('hidden'); }
});
$('#auth-google-btn').addEventListener('click', () => {
  supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
});
$('#auth-signup-btn').addEventListener('click', async () => {
  const email=$('#auth-email').value, password=$('#auth-password').value, err=$('#auth-error');
  if(!email || password.length<8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)){ err.textContent="Enter email and 8+ char alphanumeric password."; err.classList.remove('hidden'); return; }
  err.classList.add('hidden');
  const { error, data } = await supabaseClient.auth.signUp({ email, password });
  if(error){ err.textContent=error.message; err.classList.remove('hidden'); } 
  else if (data?.user && data.user.identities && data.user.identities.length === 0) { err.textContent="User already exists."; err.classList.remove('hidden'); }
  else { err.textContent="Signup successful! Please check your email and click the confirmation link, then come back here to log in."; err.style.color='var(--ink)'; err.classList.remove('hidden'); }
});
$('#logout-button').addEventListener('click', () => supabaseClient.auth.signOut());
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(window.toastTimer); window.toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }
function appConfirm(title, message) { return new Promise(resolve => { $('#confirm-title').textContent=title; $('#confirm-message').textContent=message; const dialog=$('#confirm-dialog'); dialog.showModal(); const ok=$('#confirm-ok'), cancel=$('#confirm-cancel'); function cleanup(){ok.removeEventListener('click',onOk);cancel.removeEventListener('click',onCancel);dialog.close();} function onOk(){cleanup();resolve(true);} function onCancel(){cleanup();resolve(false);} ok.addEventListener('click',onOk); cancel.addEventListener('click',onCancel); }); }
function setTheme() { document.body.dataset.theme = state.theme; }
function getDueCards(exam=currentExam()) { const today=iso(); return exam.cards.filter(card => card.due <= today).sort((a,b) => a.due.localeCompare(b.due) || a.streak-b.streak); }
function sessionsCompleted(exam) { return exam.tasks.filter(t=>t.done).length; }
function taskHours(exam, date) { return exam.tasks.filter(t=>t.date===date && t.done).reduce((n,t)=>n+t.duration,0)/60; }
function timerMinutes() { return timerMode==='focus' ? state.timer.focus : state.timer.break; }
function renderTimer() {
  const display=$('#timer-display'); if(!display) return;
  const minutes=Math.floor(timerRemaining/60), seconds=timerRemaining%60, total=timerMinutes()*60;
  display.textContent=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  $('#timer-mode').textContent=timerMode.toUpperCase();
  $('#timer-progress span').style.width=`${Math.max(0,Math.min(100,(1-timerRemaining/total)*100))}%`;
  $('#timer-start').textContent=timerInterval ? 'Pause' : `Start ${timerMode}`;
  $('#timer-focus').value=state.timer.focus; $('#timer-break').value=state.timer.break;
  const linkSelect=$('#timer-linked-task'); if(linkSelect){ const prev=linkSelect.value, today=iso(), tasks=currentExam().tasks.filter(t=>t.date===today&&!t.done); linkSelect.innerHTML='<option value="">None</option>'+tasks.map(t=>`<option value="${t.id}">${escapeHTML(t.topic)} · ${t.duration}m</option>`).join(''); linkSelect.value=prev; }
}
function pauseTimer() { clearInterval(timerInterval); timerInterval=null; renderTimer(); }
function startTimer() {
  if(timerInterval) { pauseTimer(); return; }
  timerInterval=setInterval(()=>{ timerRemaining--; if(timerRemaining<=0){const wasFocus=timerMode==='focus';timerMode=wasFocus?'break':'focus';timerRemaining=timerMinutes()*60;if(wasFocus){const linkSelect=$('#timer-linked-task'),taskId=linkSelect?.value;if(taskId){const task=currentExam().tasks.find(t=>t.id===taskId);if(task&&!task.done){task.done=true;if(linkSelect)linkSelect.value='';save();renderAll();toast('Focus done\u2014linked session marked complete!');}else{toast('Focus block complete\u2014take a break.');}}else{toast('Focus block complete\u2014take a break.');}}else{toast('Break complete\u2014ready for another block?');}} renderTimer(); },1000);
  renderTimer();
}
function resetTimer() { pauseTimer(); timerMode='focus';timerRemaining=state.timer.focus*60;renderTimer(); }
function updateTimerSettings() { const focus=Number($('#timer-focus').value), rest=Number($('#timer-break').value); if(focus<5||focus>120||rest<5||rest>60)return; state.timer={focus,break:rest};save();if(!timerInterval)timerRemaining=timerMinutes()*60;renderTimer(); }

function renderHeader() { $('#header-date').textContent = new Intl.DateTimeFormat('en',{weekday:'long',month:'long',day:'numeric'}).format(new Date()); const select=$('#exam-select'); select.innerHTML=state.exams.map(e=>`<option value="${e.id}" ${e.id===state.activeExamId?'selected':''}>${escapeHTML(e.name)}</option>`).join(''); $('#review-badge').textContent=getDueCards().length; }
function getOverdueTasks(exam) { const today=iso(); return exam.tasks.filter(t=>t.date<today&&!t.done); }
function renderOverdueHTML(overdue) { return overdue.map(t=>`<div class="task overdue-task"><div><div class="task-title">${escapeHTML(t.topic)}</div><div class="task-meta">${escapeHTML(t.type)} · ${formatDate(t.date)}</div></div><div class="overdue-actions"><button class="overdue-btn rescue" data-reschedule-task="${t.id}" title="Reschedule to tomorrow">Reschedule</button><button class="overdue-btn done" data-done-task="${t.id}" title="Mark as completed">Done</button><button class="overdue-btn skip" data-skip-task="${t.id}" title="Remove this session">Skip</button></div></div>`).join(''); }
function renderDashboard() { const exam=currentExam(), today=iso(), due=getDueCards(); const days=daysBetween(today,exam.examDate), target=Math.ceil(exam.weeklyHours/7*days); const overdue=getOverdueTasks(exam); $('#today-summary').textContent=`${days} days until ${exam.name}. Protect the next helpful session.`;
  $('#stat-grid').innerHTML=[['DAYS LEFT',days,`until ${escapeHTML(exam.name)}`],['TODAY',`${Math.round(taskHours(exam,today)*60)} min`,`${exam.tasks.filter(t=>t.date===today&&!t.done).length} sessions remaining`],['REVIEWS DUE',due.length,due.length?'prioritize weak and old cards':'your queue is clear'],['PLAN PROGRESS',`${sessionsCompleted(exam)}/${exam.tasks.length}`,`${target ? Math.round(sessionsCompleted(exam)/target*100) : 0}% of suggested rhythm`]].map(([l,n,d])=>`<article class="stat-card"><span class="eyebrow">${l}</span><div class="stat-number">${n}</div><div class="stat-detail">${d}</div></article>`).join('');
  $('#overdue-tasks').innerHTML=overdue.length?`<div class="overdue-banner"><span class="eyebrow overdue-label">⚠ ${overdue.length} MISSED SESSION${overdue.length===1?'':'S'}</span>${renderOverdueHTML(overdue)}</div>`:'';
  const tasks=exam.tasks.filter(t=>t.date===today); $('#today-tasks').innerHTML=tasks.length?tasks.map(t=>`<label class="task"><input type="checkbox" data-task-id="${t.id}" ${t.done?'checked':''}/><div><div class="task-title">${escapeHTML(t.topic)}</div><div class="task-meta">${escapeHTML(t.type)}</div></div><span class="task-duration">${t.duration} min</span></label>`).join(''):'<p class="muted">No sessions planned. Add a focused block to keep your rhythm.</p>';
  const labels=[]; let weeklyMinutes=0; for(let i=6;i>=0;i--){const d=iso(addDays(new Date(),-i)), minutes=taskHours(exam,d)*60;weeklyMinutes+=minutes;labels.push(`<div class="heat-day"><div class="heat-bar ${minutes?'active':''}" style="height:${Math.max(4,Math.min(100,minutes/1.2))}%"></div><span>${new Date(d+'T12:00').toLocaleDateString('en',{weekday:'narrow'})}</span></div>`)} $('#heatmap').innerHTML=labels.join(''); $('#weekly-total').textContent=`${Math.round(weeklyMinutes/60*10)/10}h logged`;
  $('#due-preview').innerHTML=due.length?due.slice(0,3).map(c=>`<article class="due-item"><span>${escapeHTML(c.topic)}</span><b>${escapeHTML(c.front)}</b></article>`).join(''):'<p class="muted">No reviews due today.</p>';
  renderTimer();
}
function renderAvailabilityEditor(exam) {
  $('#availability-editor').innerHTML=weekdayNames.map((name,day)=>{const hours=Number(exam.availability?.[day])||0;return `<label class="availability-row"><input data-availability-day="${day}" type="checkbox" ${hours?'checked':''}><span>${name}</span><input data-availability-hours="${day}" type="number" min="0.5" max="8" step="0.5" value="${hours||2}" ${hours?'':'disabled'} aria-label="Hours available on ${name}"></label>`;}).join('');
  const days=Object.values(exam.availability||{}).filter(hours=>Number(hours)>0).length,total=availabilityHours(exam); $('#availability-total').textContent=`${total}h per week · ${days?`${Math.round(total/days*10)/10}h average per selected study day`:'select at least one study day'}`;
}
function renderPlan() { const exam=currentExam(); $('#exam-date').value=exam.examDate; $('#plan-capacity').textContent=`${availabilityHours(exam)}h available / week`;
  renderAvailabilityEditor(exam);
  $('#topic-list').innerHTML=exam.topics.map(t=>`<div class="topic-row" style="grid-template-columns: 1fr 90px auto 34px;"><div><b>${escapeHTML(t.name)}</b><span>confidence: ${['needs work','building','comfortable','strong'][t.confidence-1]||'needs work'}</span></div><input data-topic-confidence="${t.id}" type="range" min="1" max="4" value="${t.confidence}" aria-label="Confidence for ${escapeHTML(t.name)}"><button class="secondary-button" data-view-concepts="${t.id}" style="padding:4px 10px;min-height:30px;font-size:11px;">${(t.concepts||[]).length} concepts</button><button class="icon-delete" data-delete-topic="${t.id}" title="Delete topic">×</button></div>`).join('')||'<p class="muted">Add the topics you want to study.</p>';
  const today=iso(); const overdue=getOverdueTasks(exam); const overdueDates=[...new Set(overdue.map(t=>t.date))].sort();
  const horizon=Array.from({length:14},(_,i)=>iso(addDays(new Date(),i))); const allDates=[...new Set([...overdueDates,...horizon])].sort();
  $('#schedule-list').innerHTML=allDates.map(d=>{const ts=exam.tasks.filter(t=>t.date===d);const isPast=d<today;return `<div class="schedule-day${isPast&&ts.some(t=>!t.done)?' schedule-day-overdue':''}" data-drop-date="${d}"><div class="schedule-date">${formatDate(d)}${isPast?' <span class="overdue-pill">overdue</span>':''}</div><div class="session-list">${ts.map(t=>`<span class="session${isPast&&!t.done?' session-overdue':''}" draggable="true" data-drag-task="${t.id}"><span class="tag">${escapeHTML(t.type)}</span>${escapeHTML(t.topic)} · ${t.duration}m ${isPast&&!t.done?`<button data-reschedule-task="${t.id}" title="Reschedule">↻</button><button data-done-task="${t.id}" title="Mark done">✓</button><button data-skip-task="${t.id}" title="Skip">×</button>`:`<button data-edit-task="${t.id}" title="Edit session">✎</button><button data-delete-task="${t.id}" title="Remove session">×</button>`}</span>`).join('')}${!ts.length?'<span class="muted mono">Rest / catch-up</span>':''}<button class="add-session" data-add-session-date="${d}">+ Add session</button></div></div>`}).join('');
}
function calcIntervals(c) {
  const ease=c.ease||2.5, rep=c.repetition||0, int=c.interval||0;
  return {
    again: 0,
    hard: rep===0 ? 1 : Math.max(1, Math.round(int * 1.2)),
    good: rep===0 ? 1 : (rep===1 ? 6 : Math.round(int * ease)),
    easy: rep===0 ? 4 : (rep===1 ? 6 : Math.round(int * ease * 1.3))
  };
}
function renderReview() { const exam=currentExam(),due=getDueCards(); const empty=$('#review-empty'), stage=$('#flashcard-stage'); empty.classList.toggle('hidden',!!due.length);stage.classList.toggle('hidden',!due.length); if(due.length){const card=due[0]; $('#card-count').textContent=`${due.length} card${due.length===1?'':'s'} to review`; $('#card-front').textContent=card.front; $('#card-back').textContent=card.back; $('#card-back').classList.add('hidden'); $('#flashcard .card-label').textContent='PROMPT · click to reveal'; $('#review-actions').classList.add('hidden');
  const gaps=calcIntervals(card), btn=(r,g)=>document.querySelector(`.rating.${r} small`).textContent=g<1?'< 1 day':`${g} day${g===1?'':'s'}`;
  btn('again',gaps.again);btn('hard',gaps.hard);btn('good',gaps.good);btn('easy',gaps.easy);
}
  $('#card-list').innerHTML=exam.cards.length?exam.cards.map(c=>`<div class="card-row"><div><b>${escapeHTML(c.front)}</b><p>${escapeHTML(c.topic)} · ${c.reviews} review${c.reviews===1?'':'s'}</p></div><span class="pill">${c.due<=iso()?'due now':'due '+formatDate(c.due)}</span></div>`).join(''):'<p class="muted">Your flashcards will appear here.</p>';
}
function renderMistakes() { const mistakes=currentExam().mistakes; $('#mistake-list').innerHTML=mistakes.length?mistakes.map(m=>`<article class="mistake-row"><div class="mistake-info"><span class="pill">${escapeHTML(m.topic)}</span><b>${escapeHTML(m.question)}</b><p><strong>Correct approach:</strong> ${escapeHTML(m.correct)}</p><p class="why"><strong>What went wrong:</strong> ${escapeHTML(m.why)}</p>${isLocal?`<button class="secondary-button" style="margin-top:10px; font-size:11px;" data-ai-critique="${m.id}">🧠 AI Critique</button>`:''}<div id="critique-${m.id}" class="mistake-critique hidden" style="margin-top:10px; padding:12px; background:var(--bg-body); border-radius:6px; font-size:12.5px; line-height:1.5; color:var(--ink);"></div></div><button class="icon-delete" data-delete-mistake="${m.id}" title="Delete mistake">×</button></article>`).join(''):'<div class="empty-state"><div class="empty-orb">✓</div><h2>No mistakes logged.</h2><p>When one happens, capture the lesson while it is fresh.</p></div>';
}
function renderInsights() { const e=currentExam(), due=getDueCards(e), weak=e.topics.filter(t=>t.confidence<=2), totalReview=e.cards.reduce((sum,c)=>sum+c.reviews,0); $('#insights-content').innerHTML=`<article class="panel insight"><span class="eyebrow">FOCUS NEXT</span><h2>${weak.length?escapeHTML(weak[0].name):'Keep it up'}</h2><p>${weak.length?'Lowest confidence topic - pair one practice block with a short recall review.':'All listed topics are becoming comfortable.'}</p></article><article class="panel insight"><span class="eyebrow">REVIEW LOAD</span><h2>${due.length} due</h2><p>${due.length?'Clear these before adding more new material today.':'A sustainable queue gives you space for new learning.'}</p></article><article class="panel insight"><span class="eyebrow">RETRIEVAL REPS</span><h2>${totalReview}</h2><p>Every honest rating helps the schedule learn what needs another look.</p></article>`; }
function renderAll(){setTheme();renderHeader();renderDashboard();renderPlan();renderReview();renderMistakes();renderInsights();}

function savePlanSettings(showToast=false) {
  const exam=currentExam(), availability={};
  document.querySelectorAll('[data-availability-day]').forEach(toggle=>{const day=toggle.dataset.availabilityDay,hours=document.querySelector(`[data-availability-hours="${day}"]`);availability[day]=toggle.checked?Number(hours.value):0;});
  const weeklyHours=Object.values(availability).reduce((total,hours)=>total+(Number(hours)||0),0);
  if (!$('#exam-date').value || weeklyHours<=0 || Object.values(availability).some(hours=>hours&& (hours<0.5||hours>8))) return false;
  exam.examDate=$('#exam-date').value; exam.availability=availability; exam.weeklyHours=weeklyHours;
  const selectedDays=Object.values(availability).filter(hours=>Number(hours)>0).length,average=Math.round(weeklyHours/selectedDays*10)/10;
  save(); $('#plan-capacity').textContent=`${weeklyHours}h available / week`; $('#availability-total').textContent=`${weeklyHours}h per week · ${average}h average per selected study day`;
  $('#settings-status').textContent='Saved automatically.'; if(showToast) toast('Plan settings saved.'); return true;
}
function applyBulkAvailability() {
  const hours=Number($('#bulk-availability-hours').value); if(hours<0.5||hours>8){toast('Choose between 0.5 and 8 hours.');return;}
  const selected=[...document.querySelectorAll('[data-availability-day]:checked')]; if(!selected.length){toast('Select at least one study day first.');return;}
  selected.forEach(toggle=>{const input=document.querySelector(`[data-availability-hours="${toggle.dataset.availabilityDay}"]`);input.value=hours;});
  savePlanSettings();renderPlan();toast(`Applied ${hours}h to ${selected.length} selected day${selected.length===1?'':'s'}.`);
}
async function generateSchedule() {
  if (!savePlanSettings()) { toast('Choose at least one study day and its available hours first.'); return; }
  const exam=currentExam(), today=iso(), end=iso(addDays(new Date(),13));
  const existing=exam.tasks.filter(t=>t.date>=today&&t.date<=end);
  if(existing.length>0) { const ok=await appConfirm('Regenerate schedule?', `This will replace ${existing.length} scheduled session${existing.length===1?'':'s'} in the next 14 days.`); if(!ok) return; }
  exam.tasks=exam.tasks.filter(task=>task.date<today||task.date>end);
  const topics=[...exam.topics];
  if(!topics.length){toast('Add at least one topic before generating a schedule.');return;}
  // Build weighted pool: lower confidence = more entries
  const pool=[];
  topics.forEach(t=>{ const weight=Math.max(1, 5 - t.confidence); for(let i=0;i<weight;i++) pool.push(t); });
  // Track per-topic study type cycle
  const typeOrder=['Learn','Practice','Active recall'];
  const topicTypeCursor={};
  topics.forEach(t=>{ topicTypeCursor[t.id]=0; });
  let lastDayTopics=new Set();
  for(let dayIndex=0;dayIndex<14;dayIndex++) {
    const date=iso(addDays(new Date(),dayIndex)); if(date>end) break;
    const dayMinutes=minutesAvailableOn(exam,date); if(dayMinutes<30) continue;
    const topicCount=dayMinutes<=120?1:dayMinutes<=240?2:dayMinutes<=360?3:4;
    const baseDuration=Math.floor(dayMinutes/topicCount/5)*5, remainder=dayMinutes-baseDuration*topicCount;
    // Pick topics avoiding consecutive-day repeats
    const dayTopics=[];
    const available=pool.filter(t=>!lastDayTopics.has(t.id));
    const source=available.length>=topicCount?available:pool;
    const used=new Set();
    for(let s=0;s<topicCount;s++){
      // Pick from source, avoiding same topic twice in one day
      let candidates=source.filter(t=>!used.has(t.id));
      if(!candidates.length) candidates=pool.filter(t=>!used.has(t.id));
      if(!candidates.length) candidates=pool;
      const pick=candidates[Math.floor(Math.random()*candidates.length)];
      used.add(pick.id);
      const duration=baseDuration+(s===topicCount-1?remainder:0);
      const type=typeOrder[topicTypeCursor[pick.id]%3];
      topicTypeCursor[pick.id]++;
      exam.tasks.push({id:uid(),date,topic:pick.name,type,duration,done:false});
      dayTopics.push(pick.id);
    }
    lastDayTopics=new Set(dayTopics);
  }
  save();renderAll();toast('A flexible 14-day schedule is ready to edit.');
}
function openModal(type, presetDate=iso(), existingTask=null) {
  const modal=$('#modal'),content=$('#modal-content'),exam=currentExam(); let fields='';
  const topicOptions=exam.topics.map(topic=>`<option value="${escapeHTML(topic.name)}">`).join('');
  if(type==='exam') fields=`<label class="modal-field">Plan name<input name="name" placeholder="e.g. CFA Level I" required></label><label class="modal-field">Start from a template<select name="template">${Object.keys(templates).map(t=>`<option>${t}</option>`).join('')}</select></label><label class="modal-field">Exam date<input name="examDate" type="date" value="${iso(addDays(new Date(),90))}" required></label>`;
  if(type==='topic') fields='<label class="modal-field">Topic name<input name="topic" placeholder="e.g. Probability" required></label>';
  if(type==='task') fields=`<label class="modal-field">Topic<input name="topic" list="topics" value="${existingTask?escapeHTML(existingTask.topic):''}" required><datalist id="topics">${topicOptions}</datalist></label><label class="modal-field">Type<select name="type">${['Learn','Practice','Active recall','Mock test'].map(option=>`<option ${existingTask?.type===option?'selected':''}>${option}</option>`).join('')}</select></label><label class="modal-field">Date<input name="date" type="date" value="${existingTask?.date||presetDate}" required></label><label class="modal-field">Duration (minutes)<input name="duration" type="number" value="${existingTask?.duration||60}" min="30" max="480" step="15" required></label>`;
  if(type==='card') fields=`<label class="modal-field">Prompt<input name="front" placeholder="Ask one clear recall question" required></label><label class="modal-field">Answer<textarea name="back" required></textarea></label><label class="modal-field">Topic<input name="topic" list="topics" required><datalist id="topics">${topicOptions}</datalist></label>`;
  if(type==='mistake') fields=`<label class="modal-field">Topic<input name="topic" list="topics" required><datalist id="topics">${topicOptions}</datalist></label><label class="modal-field">Question / situation<textarea name="question" placeholder="What was the question or error?" required></textarea></label><label class="modal-field">Correct approach<textarea name="correct" required></textarea></label><label class="modal-field">What went wrong?<textarea name="why" placeholder="Capture the misconception or decision that caused it." required></textarea></label>`;
  content.innerHTML=`<h2 class="modal-title">${existingTask?'Edit a study session':{exam:'Create a study plan',topic:'Add a topic',task:'Add a study session',card:'Create a flashcard',mistake:'Log a learning moment'}[type]}</h2><p class="modal-copy">${type==='mistake'?'This will also create a review card for the correct approach.':'Keep it lightweight - you can refine it later.'}</p><div class="modal-fields">${fields}</div><div class="modal-actions"><button id="modal-cancel" type="button" class="secondary-button">Cancel</button><button type="submit" class="primary-button">${existingTask?'Update session':'Save'}</button></div>`;
  modal.dataset.type=type;modal.dataset.taskId=existingTask?.id||'';modal.showModal();
}
function openConceptsModal(topicId) {
  const exam = currentExam(), topic = exam.topics.find(t=>t.id===topicId);
  if(!topic) return;
  topic.concepts = topic.concepts || [];
  const modal=$('#modal'),content=$('#modal-content');
  const conceptsList = topic.concepts.map(c => `<div class="concept-item"><div><b>${escapeHTML(c.overview)}</b><p>${escapeHTML(c.details)}</p>${c.cardId ? '<span class="pill">Flashcard</span>' : ''}</div><button type="button" class="icon-delete" data-delete-concept="${c.id}" data-topic-id="${topic.id}" title="Delete concept">×</button></div>`).join('');
  content.innerHTML=`<h2 class="modal-title">${escapeHTML(topic.name)} Concepts</h2><p class="modal-copy">Key definitions, tricky questions, or notes.</p><div class="concept-list">${conceptsList}</div><div class="modal-fields">${isLocal?'<button type="button" id="ai-spark-btn" class="secondary-button" style="margin-bottom: 12px; width: 100%;">✨ Spark Concept with AI</button>':''}<label class="modal-field">Overview (Prompt)<input name="overview" id="concept-overview" placeholder="e.g. Newton's Second Law" required></label><label class="modal-field" style="margin-top:12px;">Details (Answer)<textarea name="details" id="concept-details" placeholder="F = ma" required></textarea></label><label style="display:flex;align-items:center;gap:8px;font-size:12px;margin:12px 0 16px;"><input type="checkbox" name="makeCard" checked> Turn into a spaced-repetition flashcard</label></div><div class="modal-actions"><button type="button" id="modal-cancel" class="secondary-button">Close</button><button type="submit" class="primary-button">Add concept</button></div>`;
  if (isLocal) {
    $('#ai-spark-btn').addEventListener('click', async (e) => {
      const btn = e.target; btn.textContent = '✨ Generating...'; btn.disabled = true;
      try {
        const existing = topic.concepts.map(c => c.overview).join(', ');
        const prompt = `Suggest ONE new, highly testable concept for the topic "${topic.name}". Existing concepts: ${existing || 'None'}. Provide a short Overview (the prompt/term) and a detailed but concise Details (the answer/explanation). Format as JSON: {"overview": "...", "details": "..."}`;
        const res = await askAI('You are an expert tutor creating flashcards. Always respond with valid JSON.', prompt);
        const jsonStr = res.match(/\{[\s\S]*\}/)?.[0] || res;
        const json = JSON.parse(jsonStr);
        $('#concept-overview').value = json.overview || '';
        $('#concept-details').value = json.details || '';
        toast('AI suggested a concept!');
      } catch (err) {
        toast(`AI Error: ${err.message}`);
      } finally {
        btn.textContent = '✨ Spark Concept with AI'; btn.disabled = false;
      }
    });
  }
  modal.dataset.type='concepts'; modal.dataset.topicId=topic.id; modal.showModal();
}
let ocrPasteHandler = null;
function openOCRModal() {
  const dialog=$('#ocr-dialog'), dropzone=$('#ocr-dropzone'), fileInput=$('#ocr-file-input'), preview=$('#ocr-preview'), prompt=$('#ocr-prompt'), progressContainer=$('#ocr-progress-container'), progressBar=$('#ocr-progress-bar'), status=$('#ocr-status'), resultContainer=$('#ocr-result-container'), textResult=$('#ocr-text-result'), initialActions=$('#ocr-initial-actions');
  function reset() { preview.classList.add('hidden'); preview.src=''; prompt.classList.remove('hidden'); progressContainer.classList.add('hidden'); status.classList.add('hidden'); resultContainer.classList.add('hidden'); initialActions.classList.remove('hidden'); dropzone.style.display='block'; textResult.value=''; fileInput.value=''; }
  reset(); dialog.showModal();
  function handleImage(file) {
    if(!file||!file.type.startsWith('image/'))return;
    const url=URL.createObjectURL(file); preview.src=url; preview.classList.remove('hidden'); prompt.classList.add('hidden'); initialActions.classList.add('hidden'); progressContainer.classList.remove('hidden'); status.classList.remove('hidden'); progressBar.style.width='0%'; status.textContent='Initializing OCR...';
    Tesseract.recognize(file, 'eng', { logger: m => { if(m.status==='recognizing text'){ progressBar.style.width=`${Math.max(5,m.progress*100)}%`; status.textContent=`Extracting text: ${Math.round(m.progress*100)}%`; } else { status.textContent=m.status; } } })
    .then(({ data: { text } }) => { progressContainer.classList.add('hidden'); status.classList.add('hidden'); dropzone.style.display='none'; resultContainer.classList.remove('hidden'); textResult.value=text.trim(); })
    .catch(err => { status.textContent='Error reading image.'; console.error(err); });
  }
  dropzone.onclick=()=>fileInput.click();
  fileInput.onchange=e=>handleImage(e.target.files[0]);
  dropzone.ondragover=e=>{e.preventDefault();dropzone.classList.add('drag-over');};
  dropzone.ondragleave=()=>dropzone.classList.remove('drag-over');
  dropzone.ondrop=e=>{e.preventDefault();dropzone.classList.remove('drag-over');if(e.dataTransfer.files.length)handleImage(e.dataTransfer.files[0]);};
  if(ocrPasteHandler) document.removeEventListener('paste',ocrPasteHandler);
  ocrPasteHandler=e=>{ if(!dialog.open)return; const item=[...e.clipboardData.items].find(i=>i.type.startsWith('image/')); if(item)handleImage(item.getAsFile()); };
  document.addEventListener('paste',ocrPasteHandler);
}
async function askAI(systemPrompt, userPrompt) {
  const p = state.ai.provider, key = state.ai.keys[p];
  if(!key) throw new Error(`Missing API key for ${p}. Please add it in Settings.`);
  let res, data, text='';
  if (p === 'gemini') {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_instruction: { parts: { text: systemPrompt } }, contents: { parts: { text: userPrompt } } })
    });
    data = await res.json(); if(data.error) throw new Error(data.error.message);
    text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  } else if (p === 'openai') {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{role:'system',content:systemPrompt}, {role:'user',content:userPrompt}] })
    });
    data = await res.json(); if(data.error) throw new Error(data.error.message);
    text = data.choices?.[0]?.message?.content;
  } else if (p === 'claude') {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 1000, system: systemPrompt, messages: [{role:'user',content:userPrompt}] })
    });
    data = await res.json(); if(data.error) throw new Error(data.error.message);
    text = data.content?.[0]?.text;
  }
  if(!text) throw new Error("Empty response from AI");
  return text;
}

function handleModal(form) {
  const modal=$('#modal'), type=modal.dataset.type, data=Object.fromEntries(new FormData(form)),exam=currentExam();
  if(type==='concepts') {
    const topic=exam.topics.find(t=>t.id===modal.dataset.topicId);
    if(topic) {
      const makeCard = form.elements.makeCard?.checked;
      let cardId = null;
      if(makeCard) { cardId = uid(); exam.cards.push({id:cardId, front: data.overview, back: data.details, topic: topic.name, due: iso(), reviews: 0, ease: 2.5, interval: 0, repetition: 0}); }
      topic.concepts.push({id: uid(), overview: data.overview, details: data.details, cardId});
      save(); renderAll(); toast('Concept saved.');
      openConceptsModal(topic.id);
    }
    return;
  }
  if(type==='exam') { const template=data.template; state.exams.push({id:uid(),name:data.name.trim(),template,examDate:data.examDate,weeklyHours:8,availability:createDefaultAvailability(8),topics:templates[template].map(name=>({id:uid(),name,confidence:1,completed:0})),tasks:[],cards:[],mistakes:[]});state.activeExamId=state.exams.at(-1).id;toast('Study plan created.'); }
  if(type==='topic') exam.topics.push({id:uid(),name:data.topic.trim(),confidence:1,completed:0});
  if(type==='task') { const task=exam.tasks.find(item=>item.id===modal.dataset.taskId); if(task) Object.assign(task,{...data,duration:Number(data.duration)}); else exam.tasks.push({id:uid(),...data,duration:Number(data.duration),done:false}); }
  if(type==='card') exam.cards.push({id:uid(),...data,due:iso(),reviews:0,ease:2.5,interval:0,repetition:0});
  if(type==='mistake') { const mistake={id:uid(),...data,created:iso()};exam.mistakes.unshift(mistake);exam.cards.push({id:uid(),front:`Mistake check: ${data.question}`,back:data.correct,topic:data.topic,due:iso(),reviews:0,ease:2.5,interval:0,repetition:0,mistakeId:mistake.id}); }
  save();modal.close();renderAll();if(type!=='exam')toast(type==='mistake'?'Mistake saved and added to review queue.':'Saved.');
}

document.addEventListener('click',event=>{
  const target=event.target.closest('button,a'); if(!target)return;
  if(target.dataset.go) location.hash=target.dataset.go;
  if(target.id==='modal-close'||target.id==='modal-cancel') { $('#modal').close();return; }
  if(target.id==='settings-close') { $('#settings-dialog').close(); return; }
  if(target.id==='auth-close') { $('#auth-dialog').close(); return; }
  if(target.closest('.avatar')) { 
    $('#mobile-exam-select').innerHTML = state.exams.map(e=>`<option value="${e.id}" ${e.id===state.activeExamId?'selected':''}>${escapeHTML(e.name)}</option>`).join('');
    $('#mobile-menu-dialog').showModal(); return; 
  }
  if(target.id==='mobile-menu-close') { $('#mobile-menu-dialog').close(); return; }
  if(target.closest('#mobile-theme-button')) { $('#theme-button').click(); return; }
  if(target.closest('#mobile-settings-button')) { $('#mobile-menu-dialog').close(); $('#settings-nav-button').click(); return; }
  if(target.closest('#mobile-login-button')) { $('#mobile-menu-dialog').close(); $('#login-nav-button').click(); return; }
  if(target.closest('#mobile-logout-button')) { $('#mobile-menu-dialog').close(); $('#logout-button').click(); return; }
  if(target.id==='mobile-new-exam-button') { $('#mobile-menu-dialog').close(); $('#new-exam-button').click(); return; }
  if(target.id==='settings-export-json') {
    const backup = JSON.parse(JSON.stringify(state));
    backup.ai.keys = { gemini: '', openai: '', claude: '' }; // scrub keys
    const blob = new Blob([JSON.stringify(backup, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'estudio-backup.json';
    a.click(); URL.revokeObjectURL(url);
    return;
  }
  if(target.id==='settings-import-btn') {
    $('#settings-import-file').click();
    return;
  }
  if(target.id==='settings-export-ics') {
    const exam = currentExam();
    const futureTasks = exam.tasks.filter(t => t.date >= iso());
    if(futureTasks.length === 0 && !exam.examDate) { toast('Nothing to export.'); return; }
    
    let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Estudio//Study Planner//EN\r\n";
    
    // Export the actual exam day
    if(exam.examDate) {
      const exStart = exam.examDate.replace(/-/g, '');
      const exEnd = iso(addDays(exam.examDate, 1)).replace(/-/g, '');
      icsContent += "BEGIN:VEVENT\r\n";
      icsContent += `DTSTART;VALUE=DATE:${exStart}\r\n`;
      icsContent += `DTEND;VALUE=DATE:${exEnd}\r\n`;
      icsContent += `SUMMARY:🎯 ${exam.name} - EXAM DAY\r\n`;
      icsContent += `DESCRIPTION:Good luck on your exam!\r\n`;
      icsContent += "END:VEVENT\r\n";
    }

    futureTasks.forEach(task => {
      const dtStart = task.date.replace(/-/g, '');
      const dtEnd = iso(addDays(task.date, 1)).replace(/-/g, '');
      icsContent += "BEGIN:VEVENT\r\n";
      icsContent += `DTSTART;VALUE=DATE:${dtStart}\r\n`;
      icsContent += `DTEND;VALUE=DATE:${dtEnd}\r\n`;
      icsContent += `SUMMARY:[Study] ${task.topic} (${task.type})\r\n`;
      icsContent += `DESCRIPTION:Duration: ${task.duration} mins\r\n`;
      icsContent += "END:VEVENT\r\n";
    });
    icsContent += "END:VCALENDAR";
    
    const blob = new Blob([icsContent], {type: 'text/calendar'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'estudio-schedule.ics';
    a.click(); URL.revokeObjectURL(url);
    return;
  }
  if(target.id==='settings-delete-keys') {
    appConfirm('Delete API Keys?', 'This will remove your stored API keys from this browser.').then(ok => {
      if(!ok) return;
      state.ai.keys = { gemini: '', openai: '', claude: '' };
      $('#settings-key-gemini').value = ''; $('#settings-key-openai').value = ''; $('#settings-key-claude').value = '';
      save(); toast('API keys deleted.');
    });
  }
  if(target.id==='settings-delete-data') {
    appConfirm('Delete all data?', 'This will permanently delete all your local study data, API keys, and reset the app. If you are logged in, it will also wipe your cloud backup. This cannot be undone.').then(async ok => {
      if(!ok) return;
      $('#settings-dialog').close();
      if(currentUser) { await supabaseClient.from('study_data').delete().eq('id', currentUser.id); await supabaseClient.auth.signOut(); }
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
  }
  if(target.id==='timer-start') { startTimer(); return; }
  if(target.id==='timer-reset') { resetTimer(); return; }
  if(target.id==='new-exam-button')openModal('exam'); if(target.id==='add-topic-button')openModal('topic'); if(target.id==='add-task-button')openModal('task');
  if(target.id==='ocr-button'||target.closest('.ocr-trigger'))openOCRModal();
  if(target.id==='ocr-close'||target.id==='ocr-cancel'){$('#ocr-dialog').close();}
  if(target.id==='ocr-save-mistake'){$('#ocr-dialog').close();openModal('mistake');setTimeout(()=>{$('textarea[name="question"]').value=$('#ocr-text-result').value;},100);}
  if(target.id==='ocr-save-flashcard'){$('#ocr-dialog').close();openModal('card');setTimeout(()=>{$('input[name="front"]').value=$('#ocr-text-result').value;},100);}
  if(target.dataset.addSessionDate)openModal('task',target.dataset.addSessionDate);
  if(target.dataset.editTask){const task=currentExam().tasks.find(item=>item.id===target.dataset.editTask);if(task)openModal('task',task.date,task);}
  if(target.id==='new-card-button'||target.id==='empty-new-card')openModal('card'); if(target.id==='new-mistake-button')openModal('mistake');
  if(target.id==='apply-bulk-availability')applyBulkAvailability(); if(target.id==='generate-plan-button')generateSchedule(); if(target.id==='start-review-button')location.hash='review';
  if(target.id==='theme-button'){const themes=['night','light','ink','lavender'];state.theme=themes[(themes.indexOf(state.theme)+1)%themes.length];save();setTheme();toast(`Theme: ${state.theme}`);}
  if(target.id==='flip-card'||target.closest('#flip-card')){$('#card-back').classList.toggle('hidden');$('#review-actions').classList.toggle('hidden');$('#flashcard .card-label').textContent=$('#card-back').classList.contains('hidden')?'PROMPT · click to reveal':'ANSWER · rate your recall';}
  if(target.dataset.rating){const card=getDueCards()[0], r=target.dataset.rating, gaps=calcIntervals(card); card.interval=gaps[r]; card.due=iso(addDays(new Date(),card.interval)); card.reviews++; if(r==='again'){card.repetition=0;card.ease=Math.max(1.3,card.ease-0.20);}else if(r==='hard'){card.repetition=Math.max(1,card.repetition);card.ease=Math.max(1.3,card.ease-0.15);}else if(r==='good'){card.repetition++;}else if(r==='easy'){card.repetition++;card.ease+=0.15;} save();renderAll();toast(r==='again'?'No problem - this card will return today.':'Review scheduled.');}
  if(target.dataset.deleteTopic){const exam=currentExam();exam.topics=exam.topics.filter(topic=>topic.id!==target.dataset.deleteTopic);save();renderAll();}
  if(target.dataset.deleteTask){const exam=currentExam();exam.tasks=exam.tasks.filter(task=>task.id!==target.dataset.deleteTask);save();renderAll();}
  if(target.dataset.rescheduleTask){const exam=currentExam(),task=exam.tasks.find(t=>t.id===target.dataset.rescheduleTask);if(task){task.date=iso(addDays(new Date(),1));save();renderAll();toast('Session rescheduled to tomorrow.');}}
  if(target.dataset.doneTask){const exam=currentExam(),task=exam.tasks.find(t=>t.id===target.dataset.doneTask);if(task){task.done=true;save();renderAll();toast('Session marked complete - nice work.');}}
  if(target.dataset.skipTask){const exam=currentExam();exam.tasks=exam.tasks.filter(t=>t.id!==target.dataset.skipTask);save();renderAll();toast('Session skipped.');}
  if(target.dataset.deleteMistake){const exam=currentExam(),mistake=exam.mistakes.find(item=>item.id===target.dataset.deleteMistake);exam.mistakes=exam.mistakes.filter(item=>item.id!==target.dataset.deleteMistake);exam.cards=exam.cards.filter(card=>card.mistakeId!==target.dataset.deleteMistake&&card.front!==`Mistake check: ${mistake?.question||''}`);save();renderAll();toast('Mistake and its review card deleted.');}
  if(target.dataset.aiCritique){
    const mistake = currentExam().mistakes.find(m => m.id === target.dataset.aiCritique); if (!mistake) return;
    const btn = target, critiqueBox = document.getElementById(`critique-${mistake.id}`);
    btn.textContent = '🧠 Analyzing...'; btn.disabled = true;
    const prompt = `Critique this mistake in a supportive, encouraging, and brief manner (2-3 sentences max).\nTopic: ${mistake.topic}\nQuestion: ${mistake.question}\nCorrect Approach: ${mistake.correct}\nWhat went wrong: ${mistake.why}\nProvide one actionable insight to help avoid this cognitive trap next time. Do NOT use markdown formatting, just plain text.`;
    askAI('You are an expert, encouraging tutor.', prompt).then(text => { critiqueBox.textContent = text; critiqueBox.classList.remove('hidden'); }).catch(err => toast(`AI Error: ${err.message}`)).finally(() => { btn.textContent = '🧠 AI Critique'; btn.disabled = false; });
  }
  if(target.dataset.viewConcepts){openConceptsModal(target.dataset.viewConcepts);}
  if(target.dataset.deleteConcept){const exam=currentExam(), topic=exam.topics.find(t=>t.id===target.dataset.topicId);if(!topic)return;const concept=topic.concepts.find(c=>c.id===target.dataset.deleteConcept);if(concept){if(concept.cardId)exam.cards=exam.cards.filter(c=>c.id!==concept.cardId);topic.concepts=topic.concepts.filter(c=>c.id!==concept.id);save();renderAll();openConceptsModal(topic.id);toast('Concept deleted.');}}
});

let tutorialStep = 1;
function openTutorial() {
  tutorialStep = 1; updateTutorialUI();
  $('#tutorial-dialog').showModal();
}
function updateTutorialUI() {
  document.querySelectorAll('.tutorial-step').forEach((el, i) => el.classList.toggle('hidden', i + 1 !== tutorialStep));
  document.querySelectorAll('#tutorial-dots .dot').forEach((el, i) => el.classList.toggle('active', i + 1 === tutorialStep));
  $('#tutorial-back').classList.toggle('hidden', tutorialStep === 1);
  $('#tutorial-next').textContent = tutorialStep === 4 ? 'Finish' : 'Next';
}
$('#tutorial-skip').addEventListener('click', () => { state.tutorialCompleted = true; save(); $('#tutorial-dialog').close(); });
$('#tutorial-next').addEventListener('click', () => { 
  if (tutorialStep < 4) { tutorialStep++; updateTutorialUI(); } 
  else { state.tutorialCompleted = true; save(); $('#tutorial-dialog').close(); }
});
$('#tutorial-back').addEventListener('click', () => { if (tutorialStep > 1) { tutorialStep--; updateTutorialUI(); } });

document.addEventListener('change',event=>{const e=currentExam();if(event.target.id==='exam-select'||event.target.id==='mobile-exam-select'){state.activeExamId=event.target.value;save();renderAll();if(event.target.id==='mobile-exam-select')$('#mobile-menu-dialog').close();}if(event.target.matches('[data-task-id]')){const task=e.tasks.find(t=>t.id===event.target.dataset.taskId);task.done=event.target.checked;save();renderAll();toast(task.done?'Session logged - nice work.':'Session marked open.');}if(event.target.matches('[data-topic-confidence]')){e.topics.find(t=>t.id===event.target.dataset.topicConfidence).confidence=Number(event.target.value);save();renderAll();}});
$('#plan-settings-form').addEventListener('submit',event=>{event.preventDefault();savePlanSettings(true);});
$('#plan-settings-form').addEventListener('input',()=>savePlanSettings());
$('#plan-settings-form').addEventListener('change',event=>{if(event.target.matches('[data-availability-day]')){const hours=document.querySelector(`[data-availability-hours="${event.target.dataset.availabilityDay}"]`);hours.disabled=!event.target.checked;savePlanSettings();}});
$('#settings-import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const rawText = ev.target.result;
      if (/<script|javascript:|on\w+\s*=|data:/i.test(rawText)) {
        throw new Error("Malicious content detected in backup file. Import blocked for your security.");
      }
      const imported = JSON.parse(rawText);
      if(!imported.activeExamId || !imported.exams) throw new Error("Invalid format");
      const existingKeys = state.ai.keys;
      Object.assign(state, imported);
      if(state.ai) state.ai.keys = existingKeys; // Preserve keys across import
      save();
      location.reload();
    } catch(err) {
      alert("Invalid backup file: " + err.message);
    }
  };
  reader.readAsText(file);
});
$('#timer-focus').addEventListener('change',updateTimerSettings);
$('#timer-break').addEventListener('change',updateTimerSettings);
$('#modal-form').addEventListener('submit',event=>{event.preventDefault();handleModal(event.currentTarget);});
function navigate(){const view=location.hash.slice(1)||'dashboard';document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active-view',v.id===view));document.querySelectorAll('.nav-item[data-view]').forEach(v=>v.classList.toggle('active',v.dataset.view===view));window.scrollTo({top:0,behavior:'smooth'});}window.addEventListener('hashchange',navigate);renderAll();navigate();

/* Drag-and-drop for schedule sessions */
let draggedTaskId=null;
document.addEventListener('dragstart',e=>{const el=e.target.closest('[data-drag-task]');if(!el)return;draggedTaskId=el.dataset.dragTask;el.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',draggedTaskId);});
document.addEventListener('dragend',e=>{draggedTaskId=null;document.querySelectorAll('.dragging').forEach(el=>el.classList.remove('dragging'));document.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));});
document.addEventListener('dragover',e=>{const day=e.target.closest('[data-drop-date]');if(!day||!draggedTaskId)return;e.preventDefault();e.dataTransfer.dropEffect='move';document.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));day.classList.add('drag-over');});
document.addEventListener('dragleave',e=>{const day=e.target.closest('[data-drop-date]');if(day)day.classList.remove('drag-over');});
document.addEventListener('drop',e=>{e.preventDefault();const day=e.target.closest('[data-drop-date]');if(!day||!draggedTaskId)return;day.classList.remove('drag-over');const newDate=day.dataset.dropDate,exam=currentExam(),task=exam.tasks.find(t=>t.id===draggedTaskId);if(task&&task.date!==newDate){task.date=newDate;save();renderAll();toast(`Session moved to ${formatDate(newDate)}.`);}draggedTaskId=null;});
