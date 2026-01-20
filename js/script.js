import { db } from "./firebase-config.js";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let config = { gains: [], losses: [] };
let eventLog = [];

// FORMATADOR DE MOEDA (BRL)
const moneyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const dateInput = document.getElementById('current-date');
dateInput.valueAsDate = new Date();

async function initSystem() {
    try {
        const configRef = doc(db, "settings", "global");
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
            config = configSnap.data();
        } else {
            config = { gains: [], losses: [] };
        }
        setupEventsListener();
    } catch (e) {
        alert("Erro ao inicializar: " + e.message);
    }
}

function setupEventsListener() {
    const q = query(collection(db, "events"), orderBy("timestamp", "asc"));
    
    onSnapshot(q, (snapshot) => {
        eventLog = [];
        snapshot.forEach((doc) => {
            eventLog.push({ firebaseId: doc.id, ...doc.data() });
        });
        
        // SUCESSO: Esconde loading e mostra conteúdo
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        renderLists();
        
    }, (error) => {
        // ERRO: Mostra o problema na tela em vez de ficar carregando infinitamente
        console.error("Erro no Firestore:", error);
        const loadingDiv = document.getElementById('loading-screen');
        loadingDiv.innerHTML = `
            <h3 style="color: red">Erro de Conexão</h3>
            <p>${error.message}</p>
            <p style="font-size:0.8em">Verifique o Console (F12) e se o Banco de Dados foi criado no Firebase Console.</p>
        `;
    });
}

function getWeekNumber(dateStr) {
    const date = new Date(dateStr);
    const onejan = new Date(date.getFullYear(), 0, 1);
    const week = Math.ceil((((date - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${week}`;
}

function getMonthKey(dateStr) { return dateStr.substring(0, 7); }

function getWeeklyCount(activityId, weekStr) {
    return eventLog.filter(e => e.activityId === activityId && e.week === weekStr).length;
}

function isDoneToday(activityId, dateStr) {
    return eventLog.some(e => e.activityId === activityId && e.date === dateStr);
}

function calculateMonthlyTotal(monthKey) {
    let total = 0.0;
    const monthlyEvents = eventLog.filter(e => e.date.startsWith(monthKey));
    
    monthlyEvents.forEach(e => {
        if (e.type === 'gain') total += parseFloat(e.points);
        if (e.type === 'loss') total -= parseFloat(e.points);
    });
    return total;
}

window.renderLists = function() {
    const gainsContainer = document.getElementById('gains-list');
    const lossesContainer = document.getElementById('losses-list');
    const totalEl = document.getElementById('final-score');
    
    const dateStr = dateInput.value;
    const currentWeek = getWeekNumber(dateStr);
    const currentMonthKey = getMonthKey(dateStr);

    document.getElementById('week-display').textContent = currentWeek.split('-')[1];
    const [year, month] = currentMonthKey.split('-');
    const monthName = new Date(year, month - 1).toLocaleString('pt-BR', { month: 'long' });
    document.getElementById('month-display').textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    gainsContainer.innerHTML = '';
    lossesContainer.innerHTML = '';

    // RENDERIZA GANHOS
    if(config.gains) {
        config.gains.forEach(item => {
            const doneThisWeek = getWeeklyCount(item.id, currentWeek);
            const doneToday = isDoneToday(item.id, dateStr);
            const isWeeklyLimitReached = doneThisWeek >= item.maxPerWeek;
            const isDisabled = doneToday || isWeeklyLimitReached;
            
            let statusBadge = '';
            if (doneToday) statusBadge = '<span class="badge badge-done">Feito Hoje</span>';
            else if (isWeeklyLimitReached) statusBadge = '<span class="badge badge-blocked">Max Semanal</span>';
            
            const progress = Math.min((doneThisWeek / item.maxPerWeek) * 100, 100);

            gainsContainer.innerHTML += `
                <div class="card" style="${doneToday ? 'opacity: 0.7;' : ''}">
                    <div class="card-info">
                        <span class="activity-name">
                            ${item.name} 
                            <span class="badge badge-limit">${doneThisWeek}/${item.maxPerWeek}</span>
                            ${statusBadge}
                        </span>
                        <span class="activity-meta">+ ${moneyFmt.format(item.points)}</span>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill ${isWeeklyLimitReached?'progress-full':''}" style="width:${progress}%"></div>
                        </div>
                    </div>
                    <div class="controls">
                        <button class="btn-undo" onclick="removeLastEvent('${item.id}')" title="Desfazer">↺</button>
                        <button class="btn-add-gain" onclick="addEvent('${item.id}', 'gain')" ${isDisabled?'disabled':''}>+</button>
                    </div>
                </div>`;
        });
    }

    // RENDERIZA PERDAS
    if(config.losses) {
        config.losses.forEach(item => {
            lossesContainer.innerHTML += `
                <div class="card">
                    <div class="card-info">
                        <span class="activity-name">${item.name}</span>
                        <span class="activity-meta" style="color: #d32f2f;">- ${moneyFmt.format(item.points)}</span>
                    </div>
                    <div class="controls">
                        <button class="btn-undo" onclick="removeLastEvent('${item.id}')">↺</button>
                        <button class="btn-add-loss" onclick="addEvent('${item.id}', 'loss')">-</button>
                    </div>
                </div>`;
        });
    }

    const total = calculateMonthlyTotal(currentMonthKey);
    totalEl.textContent = moneyFmt.format(total);
    totalEl.style.color = total < 0 ? '#ff6b6b' : '#ffeb3b';
};

window.addEvent = async (itemId, type) => {
    const dateStr = dateInput.value;
    const week = getWeekNumber(dateStr);
    const item = (type==='gain'?config.gains:config.losses).find(i => i.id === itemId);

    if (type === 'gain') {
        if (isDoneToday(itemId, dateStr)) return alert("Já realizado hoje!");
        if (getWeeklyCount(itemId, week) >= item.maxPerWeek) return alert("Limite semanal!");
    }

    const btn = document.activeElement;
    if(btn) btn.disabled = true;

    try {
        await addDoc(collection(db, "events"), {
            activityId: item.id,
            name: item.name,
            points: parseFloat(item.points),
            date: dateStr,
            week: week,
            type: type,
            timestamp: serverTimestamp()
        });
    } catch (e) {
        alert("Erro: " + e.message);
        if(btn) btn.disabled = false;
    }
};

window.removeLastEvent = async (itemId) => {
    const history = eventLog.filter(e => e.activityId === itemId);
    const last = history[history.length - 1];
    if(last && confirm(`Desfazer "${last.name}"?`)) {
        await deleteDoc(doc(db, "events", last.firebaseId));
    }
};

dateInput.addEventListener('change', renderLists);
initSystem();
