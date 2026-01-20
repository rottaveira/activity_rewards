import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURAÇÃO DO FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyC2SDS3gipLUEM3wQmg1CianfBJjygPc1w",
    authDomain: "activity-reward.firebaseapp.com",
    projectId: "activity-reward",
    storageBucket: "activity-reward.firebasestorage.app",
    messagingSenderId: "325930358747",
    appId: "1:325930358747:web:fa715288fb000ebde939fe"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
