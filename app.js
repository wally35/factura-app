// ✅ VERSIÓN CON TESSERACT.JS - OCR 100% GRATIS SIN LÍMITES
let invoices = [];
let currentPhoto = null;
let modoManual = false;

// Cargar Tesseract.js desde CDN
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
document.head.appendChild(script);

function cargarFacturas() {
    try {
        const stored = localStorage.getItem('invoices');
        if (stored) {
            invoices = JSON.parse(stored);
            console.log('✅ Cargadas ' + invoices.length + ' facturas');
        } else {
            invoices = [];
        }
    } catch (e) {
        console.error('❌ Error:', e);
        invoices = [];
    }
}

function guardarFacturas() {
    try {
        localStorage.setItem('invoices', JSON.stringify(invoices));
        console.log('✅ Guardadas ' + invoices.length + ' facturas');
        return true;
    } catch (e) {
        console.error('❌ Error:', e);
        if (e.name === 'QuotaExceededError') {
            alert('❌ ALMACENAMIENTO LLENO\n\nElimina facturas antiguas.');
        }
        return false;
    }
}

const photoCamera = document.getElementById('photo-camera');
const photoGallery = document.getElementById('photo-gallery');
const photoPreview = document.getElementById('photo-preview');
const form = document.getElementById('invoice-form');
const invoiceList = document.getElementById('invoice-list');
const count = document.getElementById('count');
const fechaCalendario = document.getElementById('fecha-calendario');
const fechaManual = document.getElementById('fecha-manual');
const toggleBtn = document.getElementById('toggle-fecha');
const searchInput = document.getElementById('search-input');

if (searchInput) {
    searchInput.addEventListener('input', function(e) {
        renderInvoices(e.target.value.toLowerCase());
    });
}

toggleBtn.addEventListener('click', function() {
    if (modoManual) {
        fechaCalendario.style.display = 'flex';
        fechaManual.style.display = 'none';
        fechaManual.removeAttribute('required');
        fechaCalendario.setAttribute('required', '');
        toggleBtn.textContent = '✏️';
        modoManual = false;
    } else {
        fechaCalendario.style.display = 'none';
        fechaManual.style.display = 'flex';
        fechaCalendario.removeAttribute('required');
        fechaManual.setAttribute('required', '');
        toggleBtn.textContent = '📅';
        modoManual = true;
    }
});

fechaManual.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    let formatted = '';
    if (value.length > 0) formatted = value.substring(0, 2);
    if (value.length >= 3) formatted += '/' + value.substring(2, 4);
    if (value.length >= 5) formatted += '/' + value.substring(4, 8);
    e.target.value = formatted;
});

function toggleGarantiaPersonalizada() {
    const garantiaTipo = document.getElementById('garantia-tipo').value;
    const garantiaCustom = document.getElementById('garantia-custom');
    if (garantiaTipo === 'custom') {
        garantiaCustom.style.display = 'block';
        garantiaCustom.setAttribute('required', '');
    } else {
        garantiaCustom.style.display = 'none';
        garantiaCustom.removeAttribute('required');
    }
}

function calcularGarantia(fechaCompra, años) {
    const fecha = new Date(fechaCompra);
    fecha.setFullYear(fecha.getFullYear() + parseInt(años));
    return fecha.toISOString().split('T')[0];
}

function comprimirImagen(base64Image) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > 800) {
                height = (height * 800) / width;
                width = 800;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = () => resolve(base64Image);
        img.src = base64Image;
    });
}

photoCamera.addEventListener('change', async (e) => {
    if (e.target.files[0]) await procesarFoto(e.target.files[0]);
});

photoGallery.addEventListener('change', async (e) => {
    if (e.target.files[0]) await procesarFoto(e.target.files[0]);
});

// 🔍 PROCESAR FOTO CON TESSERACT OCR (GRATIS, SIN LÍMITES)
async function procesarFoto(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        currentPhoto = await comprimirImagen(e.target.result);
        photoPreview.src = currentPhoto;
        photoPreview.style.display = 'block';
        
        const usarOCR = confirm('¿Quieres que el OCR analice esta factura?\n\n' +
                               '✅ SÍ: Análisis automático (15-30 seg)\n' +
                               '❌ NO: Introduces datos manualmente\n\n' +
                               '📌 GRATIS e ILIMITADO (usa Tesseract OCR)');
        
        if (!usarOCR) return;
        
        const mensaje = document.createElement('div');
        mensaje.id = 'loading-ocr';
        mensaje.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); color: white; padding: 30px; border-radius: 10px; z-index: 10000; text-align: center; max-width: 300px;';
        mensaje.innerHTML = '🔍 Analizando con OCR...<br><br><small>Esto puede tardar 15-30 segundos</small><br><br><div id="progress-text" style="margin-top:10px; font-size:12px;">Iniciando...</div>';
        document.body.appendChild(mensaje);
        
        try {
            const progressText = document.getElementById('progress-text');
            
            // Usar Tesseract.js para extraer texto
            const result = await Tesseract.recognize(
                currentPhoto,
                'spa', // Español
                {
                    logger: info => {
                        if (info.status === 'recognizing text') {
                            const progress = Math.round(info.progress * 100);
                            progressText.textContent = 'Reconociendo texto: ' + progress + '%';
                        }
                    }
                }
            );
            
            const texto = result.data.text;
            console.log('📄 Texto extraído:', texto);
            
            const loadingMsg = document.getElementById('loading-ocr');
            if (loadingMsg) document.body.removeChild(loadingMsg);
            
            // Extraer datos del texto
            const datos = extraerDatosDeTexto(texto);
            
            let detectados = [];
            
            if (datos.total) {
                document.getElementById('importe').value = datos.total;
                detectados.push('💰 Total: ' + datos.total + '€');
            }
            
            if (datos.fecha) {
                if (modoManual) {
                    fechaManual.value = datos.fecha;
                } else {
                    const p = datos.fecha.split('/');
                    if (p.length === 3) {
                        fechaCalendario.value = p[2] + '-' + p[1] + '-' + p[0];
                    }
                }
                detectados.push('📅 Fecha: ' + datos.fecha);
            }
            
            if (datos.comercio) {
                document.getElementById('concepto').value = datos.comercio;
                detectados.push('🏪 Comercio: ' + datos.comercio);
            }
            
            if (detectados.length > 0) {
                alert('✅ DATOS DETECTADOS:\n\n' + detectados.join('\n') + '\n\n👀 Verifica y completa lo que falte');
            } else {
                alert('⚠️ No se detectaron datos claros.\n\n' +
                      'El texto extraído fue:\n' + texto.substring(0, 200) + '...\n\n' +
                      'Introduce los datos manualmente.');
            }
            
        } catch (error) {
            console.error('Error OCR:', error);
            const loadingMsg = document.getElementById('loading-ocr');
            if (loadingMsg) document.body.removeChild(loadingMsg);
            alert('❌ Error en OCR:\n\n' + error.message);
        }
    };
    reader.readAsDataURL(file);
}

// 🔍 EXTRAER DATOS DEL TEXTO (lógica simple)
function extraerDatosDeTexto(texto) {
    const datos = { total: null, fecha: null, comercio: null };
    
    // Buscar total (números con decimales precedidos de palabras clave)
    const regexTotal = /(?:total|importe|amount|suma|pagar)[:\s]*(\d+[.,]\d{2})/gi;
    const matchTotal = texto.match(regexTotal);
    if (matchTotal) {
        const numero = matchTotal[0].match(/(\d+[.,]\d{2})/);
        if (numero) {
            datos.total = numero[0].replace(',', '.');
        }
    }
    
    // Si no encuentra total con palabras clave, buscar el número más grande con 2 decimales
    if (!datos.total) {
        const numeros = texto.match(/\d+[.,]\d{2}/g);
        if (numeros && numeros.length > 0) {
            const numerosOrdenados = numeros.map(n => parseFloat(n.replace(',', '.'))).sort((a, b) => b - a);
            datos.total = numerosOrdenados[0].toFixed(2);
        }
    }
    
    // Buscar fecha (DD/MM/YYYY o DD-MM-YYYY)
    const regexFecha = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
    const matchFecha = texto.match(regexFecha);
    if (matchFecha) {
        const dia = matchFecha[1].padStart(2, '0');
        const mes = matchFecha[2].padStart(2, '0');
        const año = matchFecha[3];
        datos.fecha = dia + '/' + mes + '/' + año;
    }
    
    // Buscar comercio (primeras líneas, palabras en mayúsculas)
    const lineas = texto.split('\n').filter(l => l.trim().length > 3);
    for (let i = 0; i < Math.min(5, lineas.length); i++) {
        const linea = lineas[i].trim();
        // Si tiene más del 50% en mayúsculas y más de 3 caracteres
        const mayusculas = linea.replace(/[^A-Z]/g, '').length;
        if (mayusculas > linea.length * 0.5 && linea.length > 3) {
            datos.comercio = linea;
            break;
        }
    }
    
    return datos;
}

form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    let fecha, fechaISO;
    if (modoManual) {
        fecha = fechaManual.value;
        const p = fecha.split('/');
        fechaISO = p[2] + '-' + p[1] + '-' + p[0];
    } else {
        fechaISO = fechaCalendario.value;
        const f = new Date(fechaISO);
        fecha = String(f.getDate()).padStart(2, '0') + '/' + 
                String(f.getMonth() + 1).padStart(2, '0') + '/' + 
                f.getFullYear();
    }
    
    let garantiaHasta = '';
    const garantiaTipo = document.getElementById('garantia-tipo').value;
    if (garantiaTipo === 'custom') {
        garantiaHasta = document.getElementById('garantia-custom').value;
    } else if (garantiaTipo) {
        garantiaHasta = calcularGarantia(fechaISO, garantiaTipo);
    }
    
    const invoice = {
        id: Date.now(),
        fecha: fecha,
        importe: parseFloat(document.getElementById('importe').value),
        concepto: document.getElementById('concepto').value,
        categoria: document.getElementById('categoria').value,
        garantia: garantiaHasta,
        garantiaTipo: garantiaTipo,
        photo: currentPhoto,
        timestamp: new Date().toISOString()
    };
    
    invoices.unshift(invoice);
    
    if (guardarFacturas()) {
        form.reset();
        photoPreview.style.display = 'none';
        currentPhoto = null;
        toggleGarantiaPersonalizada();
        renderInvoices();
        alert('✅ Factura guardada\n\n📊 Total: ' + invoices.length);
    }
});

function renderInvoices(searchTerm = '') {
    count.textContent = invoices.length;
    
    let lista = invoices;
    if (searchTerm) {
        lista = invoices.filter(inv => inv.concepto.toLowerCase().includes(searchTerm));
    }
    
    if (lista.length === 0) {
        invoiceList.innerHTML = searchTerm ? 
            '<div class="empty-state">Sin resultados</div>' :
            '<div class="empty-state">Sin facturas<br>¡Añade la primera!</div>';
        return;
    }
    
    invoiceList.innerHTML = lista.map(function(inv) {
        let garantiaHTML = '';
        if (inv.garantia) {
            const gFecha = new Date(inv.garantia);
            const dias = Math.floor((gFecha - new Date()) / 86400000);
            if (dias < 0) {
                garantiaHTML = '<div style="color:#999;font-size:0.9em;margin-top:5px">❌ Garantía caducada</div>';
            } else if (dias < 90) {
                garantiaHTML = '<div style="color:#ff6b6b;font-size:0.9em;margin-top:5px">⚠️ Garantía: ' + formatearFecha(inv.garantia) + ' (' + dias + ' días)</div>';
            } else {
                garantiaHTML = '<div style="color:#666;font-size:0.9em;margin-top:5px">⏰ Garantía: ' + formatearFecha(inv.garantia) + '</div>';
            }
        }
        
        let imgHTML = '';
        if (inv.photo) {
            imgHTML = '<img src="' + inv.photo + '" class="invoice-image-preview" onclick="toggleImage(' + inv.id + ')" id="img-p-' + inv.id + '">' +
                     '<img src="' + inv.photo + '" class="invoice-image-full" onclick="toggleImage(' + inv.id + ')" id="img-f-' + inv.id + '" style="display:none">';
        }
        
        return '<div class="invoice-item">' +
            '<div class="invoice-header">' +
                '<div>' +
                    '<div class="invoice-amount">' + inv.importe.toFixed(2) + '€</div>' +
                    '<div class="invoice-details">' + getCategoryEmoji(inv.categoria) + ' ' + inv.categoria + ' • ' + inv.fecha + '</div>' +
                '</div>' +
                '<button class="btn-delete" onclick="deleteInvoice(' + inv.id + ')">🗑️</button>' +
            '</div>' +
            '<div><strong>' + inv.concepto + '</strong></div>' +
            garantiaHTML + imgHTML +
        '</div>';
    }).join('');
}

function toggleImage(id) {
    const p = document.getElementById('img-p-' + id);
    const f = document.getElementById('img-f-' + id);
    if (p && f) {
        if (p.style.display === 'none') {
            p.style.display = 'block';
            f.style.display = 'none';
        } else {
            p.style.display = 'none';
            f.style.display = 'block';
        }
    }
}

function deleteInvoice(id) {
    if (confirm('¿Eliminar factura?')) {
        invoices = invoices.filter(inv => inv.id !== id);
        guardarFacturas();
        renderInvoices();
    }
}

function getCategoryEmoji(cat) {
    const e = {alimentacion:'🍔',tecnologia:'📱',electrodomesticos:'⚡',ropa:'👕',hogar:'🏠',transporte:'🚗',suministros:'💡',salud:'🏥',ocio:'🎮',deportes:'🏋️',educacion:'📚',mascotas:'🐾',belleza:'💈',servicios:'🔧',otros:'📦'};
    return e[cat] || '📄';
}

function formatearFecha(iso) {
    if (!iso) return '';
    const f = new Date(iso);
    return String(f.getDate()).padStart(2,'0') + '/' + String(f.getMonth()+1).padStart(2,'0') + '/' + f.getFullYear();
}

cargarFacturas();
renderInvoices();
console.log('✅ App con Tesseract OCR iniciada');
