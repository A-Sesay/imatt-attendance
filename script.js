// --- YOUR FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "PASTE_THE_KEY_FROM_FIREBASE_HERE", 
  authDomain: "imatt-attendance.firebaseapp.com",
  projectId: "imatt-attendance",
  storageBucket: "imatt-attendance.firebasestorage.app",
  messagingSenderId: "629926774336",
  appId: "1:629926774336:web:4f50984f244b75cda101a5",
  measurementId: "G-KLR6X3V9MK"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const ADMIN_EMAIL = 'abdulaisesay167@gmail.com';
let currentClassId = null;
let currentStudentList = []; // Stores current module students for search filtering

// --- LOGIN LOGIC ---
function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;
    const btn = document.getElementById('loginBtn');
    const errEl = document.getElementById('loginError');

    if (!email || !pass) return alert("Please enter email and password");

    // Show loading state
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
    btn.disabled = true;

    auth.signInWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            setupUI(userCredential.user);
        })
        .catch((error) => {
            btn.innerHTML = '<span>Sign In to Portal</span> <i class="fas fa-arrow-right"></i>';
            btn.disabled = false;
            errEl.style.display = 'block';
            errEl.innerText = "Login Failed: " + error.message;
        });
}

function setupUI(user) {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('mainSystem').style.display = 'flex';
    
    const nameSpan = document.getElementById('displayName');
    
    if(user.email === ADMIN_EMAIL) {
        nameSpan.innerText = "Abdulai Sesay";
        document.getElementById('adminOnlyLink').style.display = 'block';
    } else {
        db.collection("lecturers").where("email", "==", user.email).get().then(snap => {
            nameSpan.innerText = !snap.empty ? snap.docs[0].data().name : user.email;
        });
    }
    
    listenForClasses();
    showSection('dashboard');
}

// --- SEARCH FILTER LOGIC ---
function filterStudents() {
    const query = document.getElementById('studentSearch').value.toLowerCase();
    const filtered = currentStudentList.filter(s => 
        s.name.toLowerCase().includes(query) || s.sid.toLowerCase().includes(query)
    );
    renderStudents(filtered);
}

// --- NAVIGATION ---
function showSection(id) {
    const sections = ['dashboardSection','adminSection','classesSection','attendanceSection','recordsSection'];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if(el) el.style.display = 'none';
    });
    
    const target = document.getElementById(id + 'Section');
    if(target) target.style.display = 'block';

    // Update Sidebar highlight
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    const navId = id === 'dashboard' ? 'nav-dash' : id === 'classes' ? 'nav-class' : 'nav-admin';
    const navEl = document.getElementById(navId);
    if(navEl) navEl.classList.add('active');
}

// --- CLASS MANAGEMENT ---
function listenForClasses() {
    db.collection("classes").onSnapshot(snapshot => {
        const grid = document.getElementById('classListItems');
        if(!grid) return;
        grid.innerHTML = '';
        document.getElementById('classCount').innerText = snapshot.size;
        
        snapshot.forEach(doc => {
            const c = doc.data();
            grid.innerHTML += `
                <div class="class-card">
                    <p style="color:var(--primary); font-weight:bold; font-size:12px; text-transform:uppercase;">${c.dept}</p>
                    <h3 style="margin: 10px 0;">${c.module}</h3>
                    <p style="color:#718096;">Year ${c.year} | Capacity: ${c.capacity}</p>
                    <div style="margin-top:20px; display:flex; gap:10px;">
                        <button class="btn-primary" style="flex:1" onclick="openAttendance('${doc.id}')">
                           <i class="fas fa-edit"></i> Register
                        </button>
                        <button class="btn-primary" style="flex:1; background:var(--accent)" onclick="viewRecords('${doc.id}')">
                           <i class="fas fa-history"></i> Records
                        </button>
                    </div>
                </div>`;
        });
    });
}

function createNewClass() {
    const module = document.getElementById('module').value;
    const dept = document.getElementById('dept').value;
    const year = document.getElementById('year').value;
    const capacity = document.getElementById('capacity').value;

    if(!module || !dept) return alert("Please fill in module details");

    db.collection("classes").add({
        module, dept, year, capacity,
        students: [],
        totalSessions: 0
    }).then(() => {
        alert("Module Created Successfully!");
        showSection('classes');
        document.getElementById('module').value = '';
        document.getElementById('dept').value = '';
        document.getElementById('capacity').value = '';
    });
}

// --- ATTENDANCE TRACKING ---
function openAttendance(id) {
    currentClassId = id;
    showSection('attendance');
    // Reset search bar
    document.getElementById('studentSearch').value = '';
    
    db.collection("classes").doc(id).get().then(doc => {
        const c = doc.data();
        document.getElementById('activeClassName').innerText = c.module;
        currentStudentList = c.students || [];
        renderStudents(currentStudentList);
    });
}

function addStudent() {
    const name = document.getElementById('stdName').value;
    const sid = document.getElementById('stdID').value;
    if(!name || !sid) return alert("Please enter Student Name and ID Number");

    db.collection("classes").doc(currentClassId).update({
        students: firebase.firestore.FieldValue.arrayUnion({ 
            sid, 
            name, 
            attended: 0 
        })
    }).then(() => {
        document.getElementById('stdName').value = '';
        document.getElementById('stdID').value = '';
        // Refresh the current view
        openAttendance(currentClassId);
    });
}

function renderStudents(students) {
    const tbody = document.getElementById('attendanceTableBody');
    tbody.innerHTML = '';
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No students found in this module.</td></tr>';
        return;
    }

    students.forEach(s => {
        tbody.innerHTML += `<tr>
            <td><strong>${s.sid}</strong></td>
            <td>${s.name}</td>
            <td class="center"><input type="radio" name="att-${s.sid}" value="p"></td>
            <td class="center"><input type="radio" name="att-${s.sid}" value="a"></td>
        </tr>`;
    });
}

function submitAttendance() {
    const btn = document.querySelector('.btn-submit');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing to Cloud...';

    db.collection("classes").doc(currentClassId).get().then(doc => {
        let students = doc.data().students;
        let sessions = (doc.data().totalSessions || 0) + 1;

        students.forEach(s => {
            const radio = document.querySelector(`input[name="att-${s.sid}"][value="p"]`);
            if(radio && radio.checked) {
                s.attended += 1;
            }
        });

        db.collection("classes").doc(currentClassId).update({ 
            students: students, 
            totalSessions: sessions 
        })
        .then(() => { 
            alert("Attendance successfully synced for Session #" + sessions); 
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sync Attendance to Cloud';
            showSection('dashboard'); 
        });
    });
}

// --- RECORDS ---
function viewRecords(id) {
    showSection('records');
    db.collection("classes").doc(id).get().then(doc => {
        const c = doc.data();
        document.getElementById('recordTitle').innerText = "History: " + c.module;
        const tbody = document.getElementById('recordsTableBody');
        const total = c.totalSessions || 0;
        tbody.innerHTML = '';
        
        c.students.forEach(s => {
            const perc = total > 0 ? Math.round((s.attended/total)*100) : 0;
            tbody.innerHTML += `<tr>
                <td>${s.sid}</td>
                <td><strong>${s.name}</strong></td>
                <td>${s.attended} / ${total}</td>
                <td><span style="color:${perc < 75 ? 'red' : 'green'}; font-weight:bold;">${perc}%</span></td>
            </tr>`;
        });
    });
}

// --- ADMIN ---
function addLecturer() {
    const name = document.getElementById('lecName').value;
    const email = document.getElementById('lecEmail').value;
    if(!name || !email) return alert("Fill lecturer details");

    db.collection("lecturers").add({ name, email, role: 'lecturer' }).then(() => {
        alert("Lecturer info saved to Cloud Firestore!");
        document.getElementById('lecName').value = '';
        document.getElementById('lecEmail').value = '';
    });
}

function logout() { 
    auth.signOut().then(() => location.reload()); 
}