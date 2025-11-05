// Base de datos local
let invoices = JSON.parse(localStorage.getItem('invoices')) || [];
let currentPhoto = null;

// Elementos del DOM
const photoCamera = document.getElementById('photo-camera');
const photoGallery = document.getElementById('photo-gallery');
const photoPreview = document.getElementById('photo-preview');
const form = document.getElementById('invoice-form');
const invoiceList = document.getElementById('invoice-list');
const count = document.getElementById('count');
const fechaInput = document.getElementById('fecha');
const calendarioInput = document.getElementById('fecha-calendar');

// Auto-formato de fecha mejorado
fechaInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, ''); // Solo números
    let formatted = '';
    
    if (value.length > 0) {
        formatted = value.substring(0, 2);
    }
    if (value.length >= 3) {
        formatted += '/' + value.substring(2, 4);
    }
    if (value.length >= 5) {
        formatted += '/' + value.substring(4, 8);
    }
    
    e.target.value = formatted;
});

// Función para abrir calendario
function abrirCalendario() {
    calendarioInput.showPicker();
}

// Cuando se selecciona fecha del calendario
calendarioInput.addEventListener('change', (e) => {
    const fecha = new Date(e.target.value);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const año = fecha.getFullYear();
    fechaInput.value = `${dia}/${mes}/${año}`;
});

// Procesar foto de cámara
photoCamera.addEventListener('change', async (e) => {
    await procesarFoto(e.target.files[0]);
});

// Procesar foto de galería
photoGallery.addEventListener('change', async (e) => {
    await procesarFoto(e.target.files[0]);
});

// Función para procesar foto con OCR
async function procesarFoto(file) {
    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            currentPhoto = e.target.result;
            photoPreview.src = currentPhoto;
            photoPreview.style.display = 'block';
            
            // Mostrar mensaje de procesamiento
            alert('📸 Procesando imagen... Esto puede tardar unos segundos');
            
            // Procesar con OCR
            try {
                const result = await Tesseract.recognize(
                    currentPhoto,
                    'spa',
                    {
                        logger: m => console.log(m)
                    }
                );
                
                const text = result.data.text;
                console.log('Texto detectado:', text);
                
                // Intentar extraer importe
                const amountMatch = text.match(/(\d+[.,]\d{2})\s*€?/);
                if (amountMatch) {
                    const amount = amountMatch[1].replace(',', '.');
                    document.getElementById('importe').value = amount;
                    alert('✅ ¡Importe detectado automáticamente! Revisa que sea correcto.');
                } else {
                    alert('⚠️ No se pudo detectar el importe automáticamente. Introdúcelo manualmente.');
                }
                
            } catch (error) {
                console.error('Error en OCR:', error);
                alert('❌ Error al procesar la imagen. Introduce los datos manualmente.');
            }
        };
        reader.readAsDataURL(file);
    }
}

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
                        ${getCategoryEmoji(invoice.categoria)} ${invoice.categoria || 'Sin categoría'} • ${invoice.fecha}
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
        'electrodomesticos': '⚡',
        'alimentacion': '🍔',
        'transporte': '🚗',
        'suministros': '💡',
        'otros': '📦'
    };
    return emojis[category] || '📄';
}

// Cargar facturas al inicio
renderInvoices();
