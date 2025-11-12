// 🔒 SISTEMA DE ALMACENAMIENTO ROBUSTO
let invoices = [];
let currentPhoto = null;
let modoManual = false;

// ⏰ CONTROL DE LÍMITE DE IA (evitar 429 errors)
let ultimaPeticionIA = 0;
const TIEMPO_MINIMO_ENTRE_PETICIONES = 5000; // 5 segundos entre peticiones

// 💾 CARGAR FACTURAS
function cargarFacturas() {
    try {
        const stored = localStorage.getItem('invoices');
        if (stored) {
            invoices = JSON.parse(stored);
            console.log('✅ Cargadas ' + invoices.length + ' facturas');
        } else {
            invoices = [];
            console.log('📋 Sin facturas previas');
        }
    } catch (e) {
        console.error('❌ Error cargando:', e);
        invoices = [];
    }
}

// 💾 GUARDAR FACTURAS
function guardarFacturas() {
    try {
        const jsonString = JSON.stringify(invoices);
        localStorage.setItem('invoices', jsonString);
        console.log('✅ Guardadas ' + invoices.length + ' facturas');
        return true;
    } catch (e) {
        console.error('❌ Error guardando:', e);
        if (e.name === 'QuotaExceededError') {
            alert('❌ ALMACENAMIENTO LLENO\n\nElimina facturas antiguas o guarda sin foto.');
        }
        return false;
    }
}

// Gemini API Key
const GEMINI_API_KEY = 'AIzaSyCKdb9YfWi23ZraEQ6PE_MgyEaw9x1s4g8';

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

// Buscador
if (searchInput) {
    searchInput.addEventListener('input', function(e) {
        renderInvoices(e.target.value.toLowerCase());
    });
}

// Toggle fecha
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

// Auto-formato fecha
fechaManual.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    let formatted = '';
    if (value.length > 0) formatted = value.substring(0, 2);
    if (value.length >= 3) formatted += '/' + value.substring(2, 4);
    if (value.length >= 5) formatted += '/' + value.substring(4, 8);
    e.target.value = formatted;
});

// Toggle garantía
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

// 🗜️ COMPRIMIR IMAGEN
function comprimirImagen(base64Image) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Max 800px de ancho
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

// Procesar fotos
photoCamera.addEventListener('change', async (e) => {
    if (e.target.files[0]) await procesarFoto(e.target.files[0]);
});

photoGallery.addEventListener('change', async (e) => {
    if (e.target.files[0]) await procesarFoto(e.target.files[0]);
});

// 🤖 PROCESAR FOTO CON IA
async function procesarFoto(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        // Comprimir
        currentPhoto = await comprimirImagen(e.target.result);
        photoPreview.src = currentPhoto;
        photoPreview.style.display = 'block';
        
        // ⏰ VERIFICAR LÍMITE DE TIEMPO
        const ahora = Date.now();
        const tiempoTranscurrido = ahora - ultimaPeticionIA;
        
        if (tiempoTranscurrido < TIEMPO_MINIMO_ENTRE_PETICIONES) {
            const segundosEspera = Math.ceil((TIEMPO_MINIMO_ENTRE_PETICIONES - tiempoTranscurrido) / 1000);
            alert('⏰ Espera ' + segundosEspera + ' segundos antes de analizar otra factura.\n\n' +
                  '(Esto evita el error de límite de peticiones)');
            return;
        }
        
        // Preguntar si quiere usar IA
        const usarIA = confirm('¿Quieres que la IA analice esta factura?\n\n' +
                              '✅ SÍ: Análisis automático (puede tardar 10 seg)\n' +
                              '❌ NO: Introduces datos manualmente\n\n' +
                              'Nota: Solo 15 análisis cada minuto.');
        
        if (!usarIA) {
            console.log('👤 Usuario eligió introducir datos manualmente');
            return;
        }
        
        ultimaPeticionIA = ahora;
        
        const mensaje = document.createElement('div');
        mensaje.id = 'loading-ia';
        mensaje.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); color: white; padding: 20px 30px; border-radius: 10px; z-index: 10000; text-align: center;';
        mensaje.innerHTML = '🤖 Analizando con IA...<br><small>Espera 5-10 segundos</small>';
        document.body.appendChild(mensaje);
        
        try {
            const base64Image = currentPhoto.split(',')[1];
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: 'Analiza este ticket/factura y extrae:\n\n1. TOTAL a pagar (número con decimales)\n2. FECHA (formato DD/MM/YYYY)\n3. COMERCIO (nombre tienda)\n4. ARTÍCULO (producto principal)\n5. CATEGORÍA (elige: alimentacion, tecnologia, electrodomesticos, ropa, hogar, transporte, suministros, salud, ocio, deportes, educacion, mascotas, belleza, servicios, otros)\n\nResponde SOLO JSON sin markdown:\n{"total":"12.50","fecha":"12/11/2025","comercio":"Mercadona","articulo":"Compra","categoria":"alimentacion"}\n\nSi no encuentras algo: null'
                            },
                            {
                                inline_data: {
                                    mime_type: 'image/jpeg',
                                    data: base64Image
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 500
                    }
                })
            });
            
            const loadingMsg = document.getElementById('loading-ia');
            if (loadingMsg) document.body.removeChild(loadingMsg);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error API:', response.status, errorText);
                
                if (response.status === 429) {
                    alert('⏰ LÍMITE DE PETICIONES\n\nGemini solo permite 15 peticiones por minuto.\n\nEspera 1 minuto o introduce datos manualmente.');
                } else if (response.status === 403) {
                    alert('⚠️ API KEY inválida o sin permisos.\n\nIntroduce datos manualmente.');
                } else {
                    alert('❌ Error ' + response.status + '\n\nIntroduce datos manualmente.');
                }
                return;
            }
            
            const data = await response.json();
            
            if (data.candidates && data.candidates[0]?.content?.parts) {
                let texto = data.candidates[0].content.parts[0].text;
                texto = texto.replace(/```json\n?/g, '').replace(/```/g, '').trim();
                
                const jsonMatch = texto.match(/\{[^}]+\}/);
                if (jsonMatch) texto = jsonMatch[0];
                
                const datos = JSON.parse(texto);
                let detectados = [];
                
                if (datos.total) {
                    document.getElementById('importe').value = String(datos.total).replace(',', '.');
                    detectados.push('💰 ' + datos.total + '€');
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
                    detectados.push('📅 ' + datos.fecha);
                }
                
                if (datos.comercio || datos.articulo) {
                    let concepto = (datos.comercio || '') + (datos.comercio && datos.articulo ? ' - ' : '') + (datos.articulo || '');
                    document.getElementById('concepto').value = concepto;
                    detectados.push('🏪 ' + concepto);
                }
                
                if (datos.categoria) {
                    document.getElementById('categoria').value = datos.categoria;
                    detectados.push('📦 ' + datos.categoria);
                }
                
                if (detectados.length > 0) {
                    alert('✅ DETECTADO:\n\n' + detectados.join('\n') + '\n\n👀 Verifica antes de guardar');
                } else {
                    alert('⚠️ No se detectaron datos.\n\nIntrodúcelos manualmente.');
                }
            } else {
                alert('⚠️ IA sin respuesta válida.\n\nIntroduce datos manualmente.');
            }
            
        } catch (error) {
            console.error('Error:', error);
            const loadingMsg = document.getElementById('loading-ia');
            if (loadingMsg) document.body.removeChild(loadingMsg);
            
            alert('❌ Error procesando IA:\n\n' + error.message + '\n\nIntroduce datos manualmente.');
        }
    };
    reader.readAsDataURL(file);
}

// 💾 GUARDAR FACTURA
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
        alert('✅ Factura guardada\n\n📊 Total: ' + invoices.length + ' facturas');
    }
});

// 📋 MOSTRAR FACTURAS
function renderInvoices(searchTerm = '') {
    count.textContent = invoices.length;
    
    let lista = invoices;
    if (searchTerm) {
        lista = invoices.filter(inv => inv.concepto.toLowerCase().includes(searchTerm));
    }
    
    if (lista.length === 0) {
        invoiceList.innerHTML = searchTerm ? 
            '<div class="empty-state">Sin resultados para "' + searchTerm + '"</div>' :
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

// INICIAR
cargarFacturas();
renderInvoices();
console.log('✅ App iniciada -', invoices.length, 'facturas');
