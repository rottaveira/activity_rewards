import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let localConfig = { gains: [], losses: [] };

// Formatador de Moeda
const moneyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

window.addItem = (type) => {
    const nameInput = document.getElementById(type === 'gain' ? 'new-gain-name' : 'new-loss-name');
    const pointsInput = document.getElementById(type === 'gain' ? 'new-gain-points' : 'new-loss-points');
    
    const name = nameInput.value;
    const points = parseFloat(pointsInput.value.replace(',', '.'));
    
    if (!name || isNaN(points)) return alert("Preencha nome e valor corretamente!");

    const id = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_") + "_" + Date.now();

    if (type === 'gain') {
        const maxInput = document.getElementById('new-gain-max');
        const max = parseInt(maxInput.value) || 7;
        localConfig.gains.push({ id, name, points, maxPerWeek: max });
        maxInput.value = '';
    } else {
        localConfig.losses.push({ id, name, points });
    }
    
    renderTables();
    nameInput.value = '';
    pointsInput.value = '';
};

window.deleteItem = (type, index) => {
    if (type === 'gain') localConfig.gains.splice(index, 1);
    else localConfig.losses.splice(index, 1);
    renderTables();
};

window.saveConfig = async () => {
    const btn = document.querySelector('.btn-save');
    btn.innerText = "Salvando...";
    try {
        await setDoc(doc(db, "settings", "global"), localConfig);
        alert("Salvo com sucesso!");
    } catch (e) {
        alert("Erro: " + e.message);
    } finally {
        btn.innerText = "SALVAR TUDO NO FIREBASE";
    }
};

async function loadConfig() {
    try {
        const docSnap = await getDoc(doc(db, "settings", "global"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            localConfig = { gains: data.gains || [], losses: data.losses || [] };
        }
        renderTables();
    } catch (error) {
        console.error(error);
    }
}

function renderTables() {
    const gainsBody = document.querySelector('#gains-table tbody');
    const lossesBody = document.querySelector('#losses-table tbody');
    gainsBody.innerHTML = '';
    lossesBody.innerHTML = '';

    localConfig.gains.forEach((item, index) => {
        gainsBody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td style="color: green; font-weight:bold;">${moneyFmt.format(item.points)}</td>
                <td>${item.maxPerWeek || 7}x</td>
                <td><button class="btn-delete" onclick="window.deleteItem('gain', ${index})">🗑️</button></td>
            </tr>`;
    });

    localConfig.losses.forEach((item, index) => {
        lossesBody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td style="color: red; font-weight:bold;">${moneyFmt.format(item.points * -1)}</td>
                <td><button class="btn-delete" onclick="window.deleteItem('loss', ${index})">🗑️</button></td>
            </tr>`;
    });
}

loadConfig();
