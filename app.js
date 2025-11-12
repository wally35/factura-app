// 📱 GESTOR DE FACTURAS PRO - Versión Híbrida Inteligente
// Intenta Gemini IA, si falla usa Tesseract OCR automáticamente

let invoices = [];
let currentPhoto = null;
let modoManual = false;

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
            alert('❌ ALMACENAMIENTO LLENO\n\nElimina facturas antiguas o guarda sin foto.');
        }
        return false;
    }
}

// Gemini API Key
const GEMINI_API_KEY = 'AIzaSyCKdb9YfWi23ZraEQ6PE_MgyEaw9x1s4g8';

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
            if (width > 1200) {
                height = (height * 1200) / width;
                width = 1200;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.filter = 'contrast(1.2) brightness(1.1)';
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
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

// 🤖 PROCESAR FOTO - HÍBRIDO INTELIGENTE
async function procesarFoto(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        currentPhoto = await comprimirImagen(e.target.result);
        photoPreview.src = currentPhoto;
        photoPreview.style.display = 'block';
        
        const usarIA = confirm('¿Analizar factura automáticamente?\n\n' +
                              '✅ SÍ: Detección automática\n' +
                              '❌ NO: Introducir manualmente');
        
        if (!usarIA) return;
        
        const mensaje = document.createElement('div');
        mensaje.id = 'loading-ia';
        mensaje.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); color: white; padding: 30px; border-radius: 10px; z-index: 10000; text-align: center; max-width: 300px;';
        mensaje.innerHTML = '🤖 Analizando factura...<br><br><small id="status-msg">Conectando con IA...</small>';
        document.body.appendChild(mensaje);
        
        // Intentar primero con Gemini IA (la buena)
        const resultadoGemini = await intentarGemini(currentPhoto, mensaje);
        
        if (resultadoGemini.exito) {
            // ✅ Gemini funcionó
            const loadingMsg = document.getElementById('loading-ia');
            if (loadingMsg) document.body.removeChild(loadingMsg);
            
            aplicarDatos(resultadoGemini.datos);
        } else {
            // ❌ Gemini falló, usar Tesseract automáticamente
            console.log('⚠️ Gemini no disponible, usando OCR local...');
            document.getElementById('status-msg').textContent = 'Analizando con OCR local...';
            
            await analizarConTesseract(currentPhoto, mensaje);
        }
    };
    reader.readAsDataURL(file);
}

// 🌟 INTENTAR CON GEMINI IA
async function intentarGemini(imagenBase64, mensajeDiv) {
    try {
        const base64Image = imagenBase64.split(',')[1];
        
        const promptMejorado = `Analiza esta factura/ticket español y extrae:

1. TOTAL con IVA (el importe final pagado)
2. FECHA (DD/MM/YYYY)
3. COMERCIO (nombre tienda)
4. ARTÍCULO (producto principal o tipo de compra)
5. CATEGORÍA:
   - alimentacion: supermercados
   - tecnologia: móviles, tablets, ordenadores
   - electrodomesticos: lavadoras, neveras, microondas (IMPORTANTE: lavadora = electrodomesticos, NO ropa)
   - ropa: tiendas de moda, ropa, zapatos
   - hogar: muebles, decoración
   - ocio: restaurantes, cine
   - otros: resto

Responde SOLO JSON:
{"total":"123.45","fecha":"12/11/2025","comercio":"MediaMarkt","articulo":"Lavadora","categoria":"electrodomesticos"}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seg timeout
        
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: promptMejorado },
                            { inline_data: { mime_type: 'image/jpeg', data: base64Image } }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 500
                    }
                })
            }
        );
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            console.log('❌ Gemini HTTP error:', response.status);
            return { exito: false };
        }
        
        const data = await response.json();
        
        if (data.candidates && data.candidates[0]?.content?.parts) {
            let texto = data.candidates[0].content.parts[0].text;
            texto = texto.replace(/```json\n?/g, '').replace(/```/g, '').trim();
            
            const jsonMatch = texto.match(/\{[\s\S]*?\}/);
            if (jsonMatch) texto = jsonMatch[0];
            
            const datos = JSON.parse(texto);
            console.log('✅ Gemini detectó:', datos);
            
            return { exito: true, datos: datos };
        }
        
        return { exito: false };
        
    } catch (error) {
        console.log('⚠️ Error Gemini:', error.message);
        return { exito: false };
    }
}

// 🔍 ANALIZAR CON TESSERACT (BACKUP)
async function analizarConTesseract(imagenBase64, mensajeDiv) {
    try {
        const progressDiv = document.getElementById('status-msg');
        
        const result = await Tesseract.recognize(
            imagenBase64,
            'spa+eng',
            {
                logger: info => {
                    if (info.status === 'recognizing text') {
                        const progress = Math.round(info.progress * 100);
                        progressDiv.textContent = 'Leyendo texto: ' + progress + '%';
                    }
                }
            }
        );
        
        const texto = result.data.text;
        console.log('📄 Texto OCR:', texto);
        
        const loadingMsg = document.getElementById('loading-ia');
        if (loadingMsg) document.body.removeChild(loadingMsg);
        
        const datos = extraerDatosDeTexto(texto);
        aplicarDatos(datos);
        
    } catch (error) {
        console.error('❌ Error Tesseract:', error);
        const loadingMsg = document.getElementById('loading-ia');
        if (loadingMsg) document.body.removeChild(loadingMsg);
        alert('⚠️ No se pudo analizar.\n\nIntroduce los datos manualmente.');
    }
}

// 📝 APLICAR DATOS DETECTADOS
function aplicarDatos(datos) {
    let detectados = [];
    let camposCompletos = 0;
    
    if (datos.total && datos.total !== 'null' && datos.total !== null) {
        const importeNumerico = String(datos.total).replace(',', '.');
        document.getElementById('importe').value = importeNumerico;
        detectados.push('💰 Total: ' + importeNumerico + '€');
        camposCompletos++;
    }
    
    if (datos.fecha && datos.fecha !== 'null' && datos.fecha !== null) {
        if (modoManual) {
            fechaManual.value = datos.fecha;
        } else {
            const p = datos.fecha.split('/');
            if (p.length === 3) {
                fechaCalendario.value = p[2] + '-' + p[1] + '-' + p[0];
            }
        }
        detectados.push('📅 Fecha: ' + datos.fecha);
        camposCompletos++;
    }
    
    if (datos.comercio || datos.articulo) {
        let concepto = '';
        if (datos.comercio && datos.comercio !== 'null' && datos.comercio !== null) {
            concepto = datos.comercio;
        }
        if (datos.articulo && datos.articulo !== 'null' && datos.articulo !== null) {
            if (concepto && datos.articulo.toLowerCase() !== concepto.toLowerCase()) {
                concepto += ' - ' + datos.articulo;
            } else if (!concepto) {
                concepto = datos.articulo;
            }
        }
        if (concepto) {
            document.getElementById('concepto').value = concepto;
            detectados.push('🏪 ' + concepto);
            camposCompletos++;
        }
    }
    
    if (datos.categoria && datos.categoria !== 'null' && datos.categoria !== null) {
        const categoriaSelect = document.getElementById('categoria');
        const optionExists = Array.from(categoriaSelect.options).some(opt => opt.value === datos.categoria);
        if (optionExists) {
            categoriaSelect.value = datos.categoria;
            detectados.push('📦 ' + datos.categoria);
            camposCompletos++;
        }
    }
    
    if (camposCompletos > 0) {
        alert('✅ Detectados ' + camposCompletos + ' campos:\n\n' + 
              detectados.join('\n') + '\n\n' +
              '👀 Revisa los datos antes de guardar');
    } else {
        alert('⚠️ No se detectaron datos.\n\nIntroduce manualmente.');
    }
}

// 🔍 EXTRAER DATOS DE TEXTO (para Tesseract)
function extraerDatosDeTexto(texto) {
    const datos = { total: null, fecha: null, comercio: null, articulo: null, categoria: null };
    
    // TOTAL
    const patronesTotal = [
        /total[:\s]*(\d+[.,]\d{2})/gi,
        /(\d+[.,]\d{2})\s*€/g
    ];
    
    for (let patron of patronesTotal) {
        patron.lastIndex = 0;
        const match = texto.match(patron);
        if (match) {
            const nums = match[match.length - 1].match(/(\d+[.,]\d{2})/);
            if (nums) {
                datos.total = nums[0].replace(',', '.');
                break;
            }
        }
    }
    
    // FECHA
    const matchFecha = texto.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/);
    if (matchFecha) {
        const dia = matchFecha[1].padStart(2, '0');
        const mes = matchFecha[2].padStart(2, '0');
        datos.fecha = dia + '/' + mes + '/' + matchFecha[3];
    }
    
    // COMERCIO
    const comercios = {
        'mercadona': 'Mercadona', 'carrefour': 'Carrefour', 'lidl': 'Lidl',
        'mediamarkt': 'MediaMarkt', 'amazon': 'Amazon'
    };
    
    const textoLower = texto.toLowerCase();
    for (let [key, nombre] of Object.entries(comercios)) {
        if (textoLower.includes(key)) {
            datos.comercio = nombre;
            break;
        }
    }
    
    datos.articulo = 'Compra';
    
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
            '<div class="empty-state">No se encontraron facturas</div>' :
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
    if (confirm('¿Eliminar esta factura?')) {
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
console.log('✅ Sistema Híbrido: Gemini IA + OCR Backup');
