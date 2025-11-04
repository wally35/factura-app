// Base de datos local
let invoices = JSON.parse(localStorage.getItem('invoices')) || [];
let currentPhoto = null;

// Elementos del DOM
const photoInput = document.getElementById('photo-input');
const photoPreview = document.getElementById('photo-preview');
const form = document.getElementById('invoice-form');
const invoiceList = document.getElementById('invoice-list');
const count = document.getElementById('count');

// Cargar foto
photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            currentPhoto = e.target.result;
            photoPreview.src = currentPhoto;
            photoPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

// Guardar factura
form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const invoice = {
        id: Date.now(),
        fecha: document.getElementById('fecha').value,
        importe: parseFloat(document.getElementById('importe').value),
        concepto: document.getElementById('concepto').value,
        categoria: document.getElementById('categoria').value,
        photo: currentPhoto,
        timestamp: new Date().toISOString()
    };
    
    invoices.unshift(invoice);
    localStorage.setItem('invoices', JSON.stringify(invoices));
    
    // Limpiar formulario
    form.reset();
    photoPreview.style.display = 'none';
    currentPhoto = null;
    
    renderInvoices();
    alert('✅ Factura guardada correctamente');
});

// Mostrar facturas
function renderInvoices() {
    count.textContent = invoices.length;
    
    if (invoices.length === 0) {
        invoiceList.innerHTML = '<div class="empty-state">No hay facturas guardadas.<br>¡Añade tu primera factura!</div>';
        return;
    }
    
    invoiceList.innerHTML = invoices.map(invoice => `
        <div class="invoice-item">
            <div class="invoice-header">
                <div>
                    <div class="invoice-amount">${invoice.importe.toFixed(2)}€</div>
                    <div class="invoice-details">
                        ${getCategoryEmoji(invoice.categoria)} ${invoice.categoria} • ${formatDate(invoice.fecha)}
                    </div>
                </div>
                <button class="btn-delete" onclick="deleteInvoice(${invoice.id})">🗑️</button>
            </div>
            <div><strong>${invoice.concepto}</strong></div>
            ${invoice.photo ? `<img src="${invoice.photo}" alt="Factura">` : ''}
        </div>
    `).join('');
}

// Eliminar factura
function deleteInvoice(id) {
    if (confirm('¿Eliminar esta factura?')) {
        invoices = invoices.filter(inv => inv.id !== id);
        localStorage.setItem('invoices', JSON.stringify(invoices));
        renderInvoices();
    }
}

// Utilidades
function getCategoryEmoji(category) {
    const emojis = {
        'alimentacion': '🍔',
        'transporte': '🚗',
        'suministros': '💡',
        'otros': '📦'
    };
    return emojis[category] || '📄';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Cargar facturas al inicio
renderInvoices();
