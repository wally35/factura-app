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

// Cambiar entre calendario y manual
let fechaManual = false;

function toggleFechaMode() {
    const toggleBtn = document.getElementById('toggle-fecha');
    
    if (fechaManual) {
        // Cambiar a calendario
        fechaInput.type = 'date';
        toggleBtn.textContent = '✏️';
        fechaManual = false;
    } else {
        // Cambiar a manual
        fechaInput.type = 'text';
        fechaInput.placeholder = 'dd/mm/aaaa';
        fechaInput.maxLength = 10;
        toggleBtn.textContent = '📅';
        fechaManual = true;
    }
}

// Auto-formato de fecha (solo cuando está en modo manual)
fechaInput.addEventListener('input', (e) => {
    if (fechaInput.type === 'text') {
        let value = e.target.value.replace(/\D/g, '');
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
    }
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
            
            alert('📸 Procesando imagen... Esto puede tardar unos segundos');
            
            try {
                const result = await Tesseract.recognize(
                    currentPhoto,
                    'spa',
                    { logger: m => console.log(m) }
                );
                
                const text = result.data.text;
                console.log('Texto detectado:', text);
                
                const amountMatch = text.match(/(\d+[.,]\d{2})\s*€?/);
                if (amountMatch) {
                    const amount = amountMatch[1].replace(',', '.');
                    document.getElementById('importe').value = amount;
                    alert('✅ ¡Importe detectado! Revisa que sea correcto.');
                } else {
                    alert('⚠️ No se detectó el importe. Introdúcelo manualmente.');
                }
            } catch (error) {
                console.error('Error en OCR:', error);
                alert('❌ Error al procesar la imagen.'
