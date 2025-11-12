// 🐛 VERSIÓN DEBUG - Para ver cuántas llamadas hace
// Base de datos local
let invoices = JSON.parse(localStorage.getItem('invoices')) || [];
let currentPhoto = null;
let modoManual = false;

// Gemini API Key
const GEMINI_API_KEY = 'AIzaSyCKdb9YfWi23ZraEQ6PE_MgyEaw9x1s4g8';

// 🔔 CONTADOR DE LLAMADAS (para debug)
let contadorLlamadas = parseInt(localStorage.getItem('debug_calls') || '0');
let ultimaHoraReset = parseInt(localStorage.getItem('debug_hour') || '0');
const horaActual = Math.floor(Date.now() / 3600000);

if (horaActual > ultimaHoraReset) {
    contadorLlamadas = 0;
    localStorage.setItem('debug_calls', '0');
    localStorage.setItem('debug_hour', horaActual.toString());
}

console.log('🔔 CONTADOR DE LLAMADAS A GEMINI: ' + contadorLlamadas);
console.log('⏰ Se reseteará en: ' + (60 - new Date().getMinutes()) + ' minutos');

// Elementos del DOM
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

// SOLO 1 evento por input
photoCamera.addEventListener('change', async function(e) {
    if (e.target.files[0]) {
        console.log('📸 Foto desde CÁMARA detectada');
        await procesarFoto(e.target.files[0]);
    }
}, { once: false }); // Asegurar que no se duplica

photoGallery.addEventListener('change', async function(e) {
    if (e.target.files[0]) {
        console.log('🖼️ Foto desde GALERÍA detectada');
        await procesarFoto(e.target.files[0]);
    }
}, { once: false });

// 🤖 Procesar foto (SOLO UNA LLAMADA)
async function procesarFoto(file) {
    if (!file) {
        console.log('❌ No hay archivo');
        return;
    }
    
    console.log('🔄 Iniciando procesamiento...');
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        currentPhoto = e.target.result;
        photoPreview.src = currentPhoto;
        photoPreview.style.display = 'block';
        
        const mensaje = document.createElement('div');
        mensaje.id = 'loading-ia';
        mensaje.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); color: white; padding: 20px 30px; border-radius: 10px; z-index: 10000; text-align: center;';
        mensaje.innerHTML = '🤖 Analizando factura...<br><small>Llamadas hoy: ' + contadorLlamadas + '</small>';
        document.body.appendChild(mensaje);
        
        try {
            const base64Image = currentPhoto.split(',')[1];
            
            // 🔔 INCREMENTAR CONTADOR ANTES DE LLAMAR
            contadorLlamadas++;
            localStorage.setItem('debug_calls', contadorLlamadas.toString());
            console.log('🔔 LLAMADA #' + contadorLlamadas + ' A GEMINI');
            
            const promptMejorado = `Analiza esta factura española y extrae:

1. TOTAL CON IVA (importe final)
2. FECHA (DD/MM/YYYY)
3. COMERCIO (nombre tienda)
4. ARTÍCULO (producto)
5. CATEGORÍA: alimentacion, tecnologia, electrodomesticos, ropa, hogar, transporte, suministros, salud, ocio, deportes, educacion, mascotas, belleza, servicios, otros

IMPORTANTE: LAVADORA = electrodomesticos

Responde SOLO JSON:
{"total":"123.45","fecha":"12/11/2025","comercio":"MediaMarkt","articulo":"Lavadora","categoria":"electrodomesticos"}`;
            
            console.log('📤 Enviando a Gemini...');
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: promptMejorado },
                            { inline_data: { mime_type: 'image/jpeg', data: base64Image } }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        topK: 32,
                        topP: 0.9,
                        maxOutputTokens: 800,
                    }
                })
            });
            
            console.log('📥 Respuesta recibida. Status:', response.status);
            
            const loadingMsg = document.getElementById('loading-ia');
            if (loadingMsg) document.body.removeChild(loadingMsg);
            
            if (!response.ok) {
                if (response.status === 429) {
                    alert('⚠️ LÍMITE ALCANZADO\n\n' +
                          'Llamadas realizadas: ' + contadorLlamadas + '\n' +
                          'Gemini permite 15 peticiones/minuto\n\n' +
                          'Introduce los datos manualmente.');
                } else {
                    throw new Error('HTTP ' + response.status);
                }
                return;
            }
            
            const data = await response.json();
            console.log('✅ Datos recibidos:', data);
            
            if (data.candidates && data.candidates[0]?.content?.parts) {
                let texto = data.candidates[0].content.parts[0].text;
                texto = texto.replace(/```json\n?/g, '').replace(/```/g, '').trim();
                
                const jsonMatch = texto.match(/\{[\s\S]*\}/);
                if (jsonMatch) texto = jsonMatch[0];
                
                const datosFactura = JSON.parse(texto);
                let datosDetectados = [];
                
                if (datosFactura.total && datosFactura.total !== null) {
                    const importeNumerico = String(datosFactura.total).replace(',', '.');
                    document.getElementById('importe').value = importeNumerico;
                    datosDetectados.push('💰 Total: ' + importeNumerico + '€');
                }
                
                if (datosFactura.fecha && datosFactura.fecha !== null) {
                    if (modoManual) {
                        fechaManual.value = datosFactura.fecha;
                    } else {
                        const partes = datosFactura.fecha.split('/');
                        if (partes.length === 3) {
                            fechaCalendario.value = partes[2] + '-' + partes[1] + '-' + partes[0];
                        }
                    }
                    datosDetectados.push('📅 Fecha: ' + datosFactura.fecha);
                }
                
                if (datosFactura.comercio || datosFactura.articulo) {
                    let concepto = '';
                    if (datosFactura.comercio && datosFactura.comercio !== null) {
                        concepto = datosFactura.comercio;
                    }
                    if (datosFactura.articulo && datosFactura.articulo !== null) {
                        concepto += (concepto ? ' - ' : '') + datosFactura.articulo;
                    }
                    document.getElementById('concepto').value = concepto;
                    datosDetectados.push('🏪 ' + concepto);
                }
                
                if (datosFactura.categoria && datosFactura.categoria !== null) {
                    const categoriaSelect = document.getElementById('categoria');
                    if (Array.from(categoriaSelect.options).some(opt => opt.value === datosFactura.categoria)) {
                        categoriaSelect.value = datosFactura.categoria;
                        datosDetectados.push('📦 ' + datosFactura.categoria);
                    }
                }
                
                if (datosDetectados.length > 0) {
                    alert('✅ Detectados ' + datosDetectados.length + ' campos:\n\n' + 
                          datosDetectados.join('\n') + '\n\n' +
                          '📊 Total llamadas hoy: ' + contadorLlamadas);
                } else {
                    alert('⚠️ No se detectaron datos.\n\nIntroduce manualmente.');
                }
            }
            
        } catch (error) {
            console.error('❌ ERROR:', error);
            const loadingMsg = document.getElementById('loading-ia');
            if (loadingMsg) document.body.removeChild(loadingMsg);
            alert('❌ Error: ' + error.message + '\n\nLlamadas hoy: ' + contadorLlamadas);
        }
    };
    
    reader.readAsDataURL(file);
}

form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    let fecha, fechaISO;
    if (modoManual) {
        fecha = fechaManual.value;
        const partes = fecha.split('/');
        fechaISO = partes[2] + '-' + partes[1] + '-' + partes[0];
    } else {
        fechaISO = fechaCalendario.value;
        const fechaObj = new Date(fechaISO);
        fecha = String(fechaObj.getDate()).padStart(2, '0') + '/' + 
                String(fechaObj.getMonth() + 1).padStart(2, '0') + '/' + 
                fechaObj.getFullYear();
    }
    
    let garantiaHasta = '';
    const garantiaTipo = document.getElementById('garantia-tipo').value;
    if (garantiaTipo === 'custom') {
        garantiaHasta = document.getElementById('garantia-custom').value;
    } else if (garantiaTipo !== '') {
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
    localStorage.setItem('invoices', JSON.stringify(invoices));
    
    form.reset();
    photoPreview.style.display = 'none';
    currentPhoto = null;
    toggleGarantiaPersonalizada();
    renderInvoices();
    alert('✅ Factura guardada');
});

function renderInvoices(searchTerm = '') {
    count.textContent = invoices.length;
    let facturasAMostrar = invoices;
    if (searchTerm) {
        facturasAMostrar = invoices.filter(inv => inv.concepto.toLowerCase().includes(searchTerm));
    }
    
    if (facturasAMostrar.length === 0) {
        invoiceList.innerHTML = searchTerm ? 
            '<div class="empty-state">No se encontraron facturas</div>' :
            '<div class="empty-state">Sin facturas</div>';
        return;
    }
    
    invoiceList.innerHTML = facturasAMostrar.map(function(invoice) {
        let garantiaHTML = '';
        if (invoice.garantia) {
            const gFecha = new Date(invoice.garantia);
            const dias = Math.floor((gFecha - new Date()) / 86400000);
            if (dias < 0) {
                garantiaHTML = '<div style="color:#999;font-size:0.9em;margin-top:5px">❌ Garantía caducada</div>';
            } else if (dias < 90) {
                garantiaHTML = '<div style="color:#ff6b6b;font-size:0.9em;margin-top:5px">⚠️ Garantía: ' + formatearFecha(invoice.garantia) + ' (' + dias + ' días)</div>';
            } else {
                garantiaHTML = '<div style="color:#666;font-size:0.9em;margin-top:5px">⏰ Garantía: ' + formatearFecha(invoice.garantia) + '</div>';
            }
        }
        
        let imagenHTML = '';
        if (invoice.photo) {
            imagenHTML = '<img src="' + invoice.photo + '" class="invoice-image-preview" onclick="toggleImage(' + invoice.id + ')" id="img-preview-' + invoice.id + '">' +
                        '<img src="' + invoice.photo + '" class="invoice-image-full" onclick="toggleImage(' + invoice.id + ')" id="img-full-' + invoice.id + '" style="display:none">';
        }
        
        return '<div class="invoice-item">' +
            '<div class="invoice-header">' +
                '<div>' +
                    '<div class="invoice-amount">' + invoice.importe.toFixed(2) + '€</div>' +
                    '<div class="invoice-details">' + getCategoryEmoji(invoice.categoria) + ' ' + invoice.categoria + ' • ' + invoice.fecha + '</div>' +
                '</div>' +
                '<button class="btn-delete" onclick="deleteInvoice(' + invoice.id + ')">🗑️</button>' +
            '</div>' +
            '<div><strong>' + invoice.concepto + '</strong></div>' +
            garantiaHTML + imagenHTML +
        '</div>';
    }).join('');
}

function toggleImage(id) {
    const p = document.getElementById('img-preview-' + id);
    const f = document.getElementById('img-full-' + id);
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
    if (confirm('¿Eliminar?')) {
        invoices = invoices.filter(inv => inv.id !== id);
        localStorage.setItem('invoices', JSON.stringify(invoices));
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

renderInvoices();
console.log('✅ App iniciada - Modo DEBUG activado');
console.log('🔔 Verás el contador de llamadas en cada análisis');
