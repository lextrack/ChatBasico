firebase.initializeApp(window.firebaseConfig);

const auth = firebase.auth();
const database = firebase.database();

window.auth = auth;
window.database = database;