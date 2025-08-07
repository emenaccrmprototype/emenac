import { collection, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function() {
    
    // --- DATA STORE ---
    let queriesData = [];
    let leadsData = [];
    let bookingsData = [];
    let activeRecord = { type: null, id: null };

    // --- PAGE & VIEW MANAGEMENT ---
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page-content');
    function showPage(targetId) { pages.forEach(p => p.classList.toggle('hidden', p.id !== targetId)); }
    navLinks.forEach(link => { link.addEventListener('click', function(e) { e.preventDefault(); navLinks.forEach(l => l.classList.remove('active')); this.classList.add('active'); showPage(this.dataset.target); }); });
    document.querySelectorAll('.btn-cancel').forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.target)));

    // --- FIREBASE LISTENERS ---
    function setupFirebaseListeners() {
        const db = window.firebaseDB;
        if (!db) { console.error("Firestore is not initialized."); return; }
        onSnapshot(query(collection(db, "queries"), orderBy("timestamp", "desc")), (snapshot) => { queriesData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })); renderQueriesTable(); });
        onSnapshot(query(collection(db, "leads"), orderBy("timestamp", "desc")), (snapshot) => { leadsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })); renderLeadsTable(); });
        onSnapshot(query(collection(db, "bookings"), orderBy("bookingDate", "desc")), (snapshot) => { bookingsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })); renderBookingsTable(); });
    }

    // --- TABLE RENDERING ---
    const queriesTableBody = document.querySelector('#queries-table tbody');
    const leadsTableBody = document.querySelector('#leads-table tbody');
    const bookingsTableBody = document.querySelector('#bookings-table tbody');

    function renderQueriesTable(data = queriesData) {
        queriesTableBody.innerHTML = '';
        data.forEach((query) => {
            const latestRemark = query.remarks && query.remarks.length > 0 ? query.remarks[query.remarks.length - 1].text : 'No comments';
            queriesTableBody.innerHTML += `<tr data-id="${query.id}"><td>${new Date(query.timestamp?.toDate()).toLocaleString()}</td><td>${query.queryId}</td><td>${query.agentEmail}</td><td>${query.source}</td><td>${query.cxName}</td><td>${query.contactNumber}</td><td>${query.email}</td><td data-field="followUpDate">${query.followUpDate}</td><td data-field="leadStage">${query.leadStage}</td><td class="remarks-column"><div class="remarks-cell"><span class="latest-remark">${latestRemark}</span><button class="btn btn-edit btn-comments" data-type="queries"><i class="fas fa-comments"></i></button></div></td></tr>`;
        });
    }
    function renderLeadsTable(data = leadsData) {
        leadsTableBody.innerHTML = '';
        data.forEach((lead) => {
            const latestRemark = lead.remarks && lead.remarks.length > 0 ? lead.remarks[lead.remarks.length - 1].text : 'No comments';
            leadsTableBody.innerHTML += `<tr data-id="${lead.id}"><td>${new Date(lead.timestamp?.toDate()).toLocaleString()}</td><td>${lead.queryId}</td><td>${lead.agentEmail}</td><td>${lead.cxName}</td><td>${lead.productService}</td><td data-field="followUpDate">${lead.followUpDate}</td><td data-field="leadStage">${lead.leadStage}</td><td class="remarks-column"><div class="remarks-cell"><span class="latest-remark">${latestRemark}</span><button class="btn btn-edit btn-comments" data-type="leads"><i class="fas fa-comments"></i></button></div></td></tr>`;
        });
    }
    function renderBookingsTable(data = bookingsData) {
        bookingsTableBody.innerHTML = '';
        data.forEach((booking) => {
            bookingsTableBody.innerHTML += `<tr data-id="${booking.id}"><td>${booking.folderNo}</td><td>${new Date(booking.bookingDate?.toDate()).toLocaleString()}</td><td>${booking.queryId}</td><td>${booking.agentEmail}</td><td>${booking.cxName}</td><td>${booking.contactNumber}</td><td>${booking.email}</td></tr>`;
        });
    }

    // --- SEARCH ---
    document.getElementById('query-search-input').addEventListener('input', e => { renderQueriesTable(queriesData.filter(q => Object.values(q).some(val => String(val).toLowerCase().includes(e.target.value.toLowerCase())))); });
    document.getElementById('lead-search-input').addEventListener('input', e => { renderLeadsTable(leadsData.filter(l => Object.values(l).some(val => String(val).toLowerCase().includes(e.target.value.toLowerCase())))); });
    document.getElementById('booking-search-input').addEventListener('input', e => { renderBookingsTable(bookingsData.filter(b => Object.values(b).some(val => String(val).toLowerCase().includes(e.target.value.toLowerCase())))); });

    // --- ADD NEW QUERY ---
    document.getElementById('add-query-btn').addEventListener('click', () => {
        document.getElementById('add-query-form').reset();
        document.getElementById('new-query-timestamp').value = new Date().toLocaleString();
        document.getElementById('new-query-id').value = 'Q' + Date.now();
        showPage('add-query-page');
    });
    document.getElementById('add-query-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const remarkText = document.getElementById('new-query-remarks').value;
        await addDoc(collection(window.firebaseDB, "queries"), {
            timestamp: serverTimestamp(), queryId: document.getElementById('new-query-id').value, agentEmail: document.getElementById('new-query-agent').value, source: document.getElementById('new-query-source').value,
            cxName: document.getElementById('new-query-cx-name').value, contactNumber: document.getElementById('new-query-contact').value, email: document.getElementById('new-query-email').value,
            followUpDate: document.getElementById('new-query-follow-up').value, leadStage: document.getElementById('new-query-lead-stage').value,
            remarks: remarkText ? [{ text: remarkText, timestamp: new Date().toISOString() }] : []
        });
        showPage('queries-page');
    });

    // --- IN-PLACE EDITING ---
    async function updateField(collectionName, docId, field, value) { await updateDoc(doc(window.firebaseDB, collectionName, docId), { [field]: value }); }
    function enableEditing(tableBody, collectionName, stageOptions) {
        tableBody.addEventListener('dblclick', function(e) {
            const cell = e.target.closest('td');
            if (!cell || !cell.dataset.field || document.querySelector('.inline-editor')) return;
            const field = cell.dataset.field;
            const docId = cell.parentElement.dataset.id;
            const originalValue = cell.textContent;
            cell.innerHTML = ''; let editor;
            if (field.includes('Stage')) {
                editor = document.createElement('select');
                stageOptions.forEach(stage => { const option = document.createElement('option'); option.value = stage; option.textContent = stage; if (stage === originalValue) option.selected = true; editor.appendChild(option); });
            } else { editor = document.createElement('input'); editor.type = 'date'; editor.value = originalValue; }
            editor.className = 'inline-editor';
            const saveChanges = async () => {
                const newValue = editor.value;
                if(newValue === originalValue) { tableBody === queriesTableBody ? renderQueriesTable() : renderLeadsTable(); return; }
                
                // CORRECTED LOGIC: Update the field first, then trigger the next action.
                await updateField(collectionName, docId, field, newValue);

                if (field === 'leadStage' && newValue === 'Qualified' && collectionName === 'queries') {
                    promoteToLead(docId);
                } else if (field === 'leadStage' && newValue === 'Booked' && collectionName === 'leads') {
                    openBookingCreationModal(docId);
                }
            };
            editor.addEventListener('blur', saveChanges);
            editor.addEventListener('keydown', e => { if (e.key === 'Enter') editor.blur(); else if (e.key === 'Escape') tableBody === queriesTableBody ? renderQueriesTable() : renderLeadsTable(); });
            cell.appendChild(editor); editor.focus();
        });
    }
    enableEditing(queriesTableBody, 'queries', ['Fresh Query', 'In-Contact', 'Qualified', 'Lost']);
    enableEditing(leadsTableBody, 'leads', ['Fresh Lead', 'Follow ups', 'Lost', 'Booked']);

    // --- LEAD PROMOTION ---
    function promoteToLead(queryId) {
        activeRecord = { type: 'queries', id: queryId };
        const query = queriesData.find(q => q.id === queryId);
        document.getElementById('promote-lead-form').reset();
        document.getElementById('lead-timestamp').value = new Date(query.timestamp.toDate()).toLocaleString();
        document.getElementById('lead-query-id').value = query.queryId; document.getElementById('lead-agent').value = query.agentEmail; document.getElementById('lead-source').value = query.source;
        document.getElementById('lead-cx-name').value = query.cxName; document.getElementById('lead-contact').value = query.contactNumber; document.getElementById('lead-email').value = query.email;
        document.getElementById('lead-follow-up').value = new Date().toISOString().split('T')[0];
        showPage('promote-lead-page');
    }
    document.getElementById('promote-lead-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const originalQuery = queriesData.find(q => q.id === activeRecord.id);
        const newLead = { ...originalQuery, timestamp: serverTimestamp(), productService: document.getElementById('lead-products').value, followUpDate: document.getElementById('lead-follow-up').value, leadStage: document.getElementById('lead-stage').value, remarks: [{ text: document.getElementById('lead-remarks').value, timestamp: new Date().toISOString() }] };
        delete newLead.id;
        await addDoc(collection(window.firebaseDB, "leads"), newLead);
        await updateField('queries', activeRecord.id, 'leadStage', 'Qualified');
        showPage('queries-page');
    });

    // --- BOOKING CREATION ---
    function openBookingCreationModal(leadId) {
        activeRecord = { type: 'leads', id: leadId };
        const form = document.getElementById('booking-creation-form');
        form.reset();
        form.querySelector('#booking-folder-no').value = '';
        form.querySelector('#booking-date').value = new Date().toLocaleString();
        form.querySelector('#booking-cx-name').value = leadsData.find(l => l.id === leadId).cxName;
        form.querySelectorAll('.dynamic-list').forEach(list => { while (list.children.length > 1) { list.removeChild(list.lastChild); } });
        form.querySelector('#one-way').checked = true;
        showPage('booking-creation-page');
    }
    document.getElementById('booking-creation-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const lead = leadsData.find(l => l.id === activeRecord.id);
        const newBooking = { bookingDate: serverTimestamp(), folderNo: document.getElementById('booking-folder-no').value, queryId: lead.queryId, agentEmail: lead.agentEmail, cxName: document.getElementById('booking-cx-name').value, contactNumber: lead.contactNumber, email: lead.email, flights: [], hotels: [], others: [] };
        document.querySelectorAll('#flights-list .flight-row').forEach(r => newBooking.flights.push({ airline: r.querySelector('.flight-airline').value, flightNo: r.querySelector('.flight-no').value, depFrom: r.querySelector('.flight-dep-from').value, depDate: r.querySelector('.flight-dep-date').value, arrAt: r.querySelector('.flight-arr-at').value, arrDate: r.querySelector('.flight-arr-date').value, connFlight: r.querySelector('.flight-conn-no').value }));
        document.querySelectorAll('#hotels-list .hotel-row').forEach(r => newBooking.hotels.push({ name: r.querySelector('.hotel-prop-name').value, room: r.querySelector('.hotel-room-type').value, qty: r.querySelector('.hotel-qty').value, guests: r.querySelector('.hotel-guests').value, board: r.querySelector('.hotel-board').value, checkin: r.querySelector('.hotel-checkin').value, checkout: r.querySelector('.hotel-checkout').value, city: r.querySelector('.hotel-city').value }));
        document.querySelectorAll('#others-list .other-row').forEach(r => newBooking.others.push({ narration: r.querySelector('.other-narrate').value, pax: r.querySelector('.other-pax').value }));
        await addDoc(collection(window.firebaseDB, "bookings"), newBooking);
        await updateField('leads', activeRecord.id, 'leadStage', 'Booked');
        showPage('bookings-page');
    });

    // --- VIEW BOOKING DETAILS ---
    bookingsTableBody.addEventListener('dblclick', (e) => {
        const docId = e.target.closest('tr').dataset.id; if (!docId) return;
        const booking = bookingsData.find(b => b.id === docId);
        const contentArea = document.getElementById('booking-details-content');
        const toDetails = (arr, cb) => arr && arr.length > 0 ? arr.map(cb).join('') : '<div class="details-item">N/A</div>';
        contentArea.innerHTML = `<div class="details-grid"><div class="details-section"><h4>Booking Info</h4><div class="details-item"><span>Folder:</span>${booking.folderNo}</div><div class="details-item"><span>Date:</span>${new Date(booking.bookingDate.toDate()).toLocaleString()}</div><div class="details-item"><span>Agent:</span>${booking.agentEmail}</div></div><div class="details-section"><h4>Customer Info</h4><div class="details-item"><span>Name:</span>${booking.cxName}</div><div class="details-item"><span>Contact:</span>${booking.contactNumber}</div><div class="details-item"><span>Email:</span>${booking.email}</div></div></div><hr class="form-divider"><div class="details-section"><h4>Flights</h4>${toDetails(booking.flights, f => `<div class="details-item">${f.airline || ''} ${f.flightNo || ''} | ${f.depFrom} (${f.depDate}) -> ${f.arrAt} (${f.arrDate})</div>`)}</div><hr class="form-divider"><div class="details-section"><h4>Hotels</h4>${toDetails(booking.hotels, h => `<div class="details-item">${h.name || ''} in ${h.city || ''} | ${h.checkin} to ${h.checkout}</div>`)}</div><hr class="form-divider"><div class="details-section"><h4>Other Services</h4>${toDetails(booking.others, o => `<div class="details-item">${o.narration || ''} | PAX: ${o.pax || 0}</div>`)}</div>`;
        showPage('view-booking-page');
    });

    // --- REUSABLE COMMENTS MODAL ---
    const commentsModal = document.getElementById('comments-modal');
    async function openCommentsModal(event) {
        const button = event.target.closest('.btn-comments');
        const type = button.dataset.type;
        const id = button.closest('tr').dataset.id;
        activeRecord = { type, id };
        const dataArray = type === 'queries' ? queriesData : leadsData;
        const record = dataArray.find(item => item.id === id);
        document.getElementById('comment-modal-title').textContent = `Comments for ID #${record.queryId || record.id}`;
        const list = document.getElementById('comments-list'); list.innerHTML = '';
        if (!record.remarks || record.remarks.length === 0) { list.innerHTML = '<p>No comments yet.</p>'; }
        else { record.remarks.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).forEach(r => { list.innerHTML += `<div class="comment"><div class="comment-text">${r.text}</div><div class="comment-timestamp">${new Date(r.timestamp).toLocaleString()}</div></div>`; }); }
        commentsModal.classList.add('active');
    }
    document.getElementById('add-comment-btn').addEventListener('click', async function() {
        const text = document.getElementById('new-comment-input').value.trim();
        if (text === '' || !activeRecord.type) return;
        const dataArray = activeRecord.type === 'queries' ? queriesData : leadsData;
        const record = dataArray.find(item => item.id === activeRecord.id);
        const updatedRemarks = [...(record.remarks || []), { text, timestamp: new Date().toISOString() }];
        await updateField(activeRecord.type, activeRecord.id, 'remarks', updatedRemarks);
        document.getElementById('new-comment-input').value = '';
        commentsModal.classList.remove('active');
    });

    // --- GLOBAL EVENT LISTENERS ---
    document.querySelectorAll('.modal').forEach(modal => {
        modal.querySelector('.close-modal')?.addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
    });
    
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.btn-comments')) {
            openCommentsModal(e);
            return;
        }
        const activeEditor = document.querySelector('.inline-editor');
        if (activeEditor && !activeEditor.parentElement.contains(e.target)) {
            activeEditor.blur();
        }
        const cell = e.target.closest('td');
        const currentlyExpanded = document.querySelector('.show-full-content');
        if (currentlyExpanded) {
            currentlyExpanded.classList.remove('show-full-content');
        }
        if (cell && !cell.dataset.field && cell !== currentlyExpanded) {
            if (cell.scrollWidth > cell.clientWidth) {
                cell.classList.add('show-full-content');
            }
        }
    });

    // Other UI Logic
    document.querySelectorAll('input[name="tripType"]').forEach(radio => radio.addEventListener('change', (e) => { const flightsList = document.getElementById('flights-list'); if (e.target.value === 'return' && flightsList.children.length < 2) { const newRow = flightsList.children[0].cloneNode(true); newRow.querySelectorAll('input').forEach(input => input.value = ''); flightsList.appendChild(newRow); } else if (e.target.value === 'one-way' && flightsList.children.length > 1) { flightsList.removeChild(flightsList.lastChild); } }));
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-add-row')) { const targetList = document.getElementById(e.target.dataset.target); const newRow = targetList.children[0].cloneNode(true); newRow.querySelectorAll('input, select').forEach(input => input.value = ''); targetList.appendChild(newRow); }
        if (e.target.classList.contains('btn-remove-row')) { const row = e.target.closest('.dynamic-row'); if (row.parentElement.children.length > 1) { row.remove(); } }
    });
    document.getElementById('booking-creation-page').addEventListener('change', (e) => {
        const row = e.target.closest('.dynamic-row');
        if (row?.classList.contains('flight-row')) { const depDate = row.querySelector('.flight-dep-date'), arrDate = row.querySelector('.flight-arr-date'); if (depDate.value && arrDate.value && arrDate.value < depDate.value) { alert('Arrival Date cannot be before Departure Date.'); arrDate.value = ''; } }
        if (row?.classList.contains('hotel-row')) { const checkin = row.querySelector('.hotel-checkin'), checkout = row.querySelector('.hotel-checkout'); if (checkin.value && checkout.value && checkout.value < checkin.value) { alert('Check Out Date cannot be before Check In Date.'); checkout.value = ''; } }
    });

    // --- INITIALIZATION ---
    setTimeout(setupFirebaseListeners, 1500);
    showPage('home-page');
});
