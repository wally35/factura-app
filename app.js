// 📱 GESTOR DE FACTURAS PRO - Versión con IA Gemini Optimizada
let invoices = [];
let currentPhoto = null;
let modoManual = false;

// Control silencioso de límites
let peticionesHoy = parseInt(localStorage.getItem('gemini_count') || '0');
let ultimoDia = localStorage.getItem('gemini_date') || '';
const hoy = new Date().toDateString();

if (ultimoDia !== hoy) {
    peticionesHoy = 0;
    localStorage.setItem('gemini_count', '0');
    localStorage.setItem('gemini_date', hoy);
}

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
            if (width > 1000) {
                height = (height * 1000) / width;
                width = 1000;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
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

// 🤖 PROCESAR FOTO CON GEMINI IA
async function procesarFoto(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        currentPhoto = await comprimirImagen(e.target.result);
        photoPreview.src = currentPhoto;
        photoPreview.style.display = 'block';
        
        const usarIA = confirm('¿Analizar factura automáticamente?\n\n' +
                              '✅ SÍ: Detección inteligente con IA\n' +
                              '❌ NO: Introducir datos manualmente');
        
        if (!usarIA) return;
        
        const mensaje = document.createElement('div');
        mensaje.id = 'loading-ia';
        mensaje.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); color: white; padding: 30px; border-radius: 10px; z-index: 10000; text-align: center; max-width: 300px;';
        mensaje.innerHTML = '🤖 Analizando factura con IA...<br><br><small>Esto puede tardar unos segundos</small>';
        document.body.appendChild(mensaje);
        
        try {
            const base64Image = currentPhoto.split(',')[1];
            
            // Prompt ULTRA mejorado para Gemini
            const promptMejorado = `Eres un experto en análisis de facturas y tickets de compra españoles.

Analiza esta imagen de factura/ticket y extrae la siguiente información:

1. TOTAL FINAL A PAGAR (IMPORTANTE: el importe CON IVA incluido, el importe final que pagó el cliente)
   - Busca: "TOTAL", "TOTAL A PAGAR", "IMPORTE", o el número más destacado
   - DEBE incluir IVA
   - Formato: solo el número con 2 decimales (ejemplo: "25.50")

2. FECHA de la compra
   - Formato: DD/MM/YYYY (ejemplo: "12/11/2025")

3. COMERCIO / TIENDA
   - Nombre del establecimiento (ejemplo: "Mercadona", "MediaMarkt", "Amazon")

4. PRODUCTO / ARTÍCULO principal
   - Si es un solo producto: su nombre (ejemplo: "Lavadora Samsung")
   - Si son varios productos: describe la compra (ejemplo: "Compra semanal", "Electrónica")

5. CATEGORÍA (elige LA MÁS ADECUADA):
   - alimentacion: supermercados, comida
   - tecnologia: móviles, ordenadores, tablets, auriculares
   - electrodomesticos: lavadoras, neveras, microondas, aspiradoras
   - ropa: tiendas de moda, ropa, zapatos
   - hogar: muebles, decoración, menaje
   - transporte: gasolina, taxis, transporte
   - suministros: luz, agua, gas
   - salud: farmacias, médicos
   - ocio: restaurantes, cine, entretenimiento
   - deportes: gimnasios, material deportivo
   - educacion: libros, material escolar
   - mascotas: tiendas de animales
   - belleza: peluquerías, cosméticos
   - servicios: reparaciones, servicios profesionales
   - otros: si no encaja en ninguna anterior

IMPORTANTE:
- Si es una LAVADORA → categoría: "electrodomesticos" (NO "ropa")
- Si es ROPA/ZAPATOS → categoría: "ropa"
- El TOTAL debe ser CON IVA (el importe final)

Responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin explicaciones):

{
  "total": "123.45",
  "fecha": "12/11/2025",
  "comercio": "MediaMarkt",
  "articulo": "Lavadora Samsung",
  "categoria": "electrodomesticos"
}

Si NO encuentras algún dato, pon: null`;

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: promptMejorado },
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
                            topK: 32,
                            topP: 0.9,
                            maxOutputTokens: 1000
                        }
                    })
                }
            );
            
            const loadingMsg = document.getElementById('loading-ia');
            if (loadingMsg) document.body.removeChild(loadingMsg);
            
            if (!response.ok) {
                if (response.status === 429) {
                    // Silenciosamente ofrecer entrada manual
                    alert('El análisis automático no está disponible en este momento.\n\nPor favor, introduce los datos manualmente.');
                    return;
                }
                throw new Error('Error en el análisis');
            }
            
            const data = await response.json();
            
            if (data.candidates && data.candidates[0]?.content?.parts) {
                let texto = data.candidates[0].content.parts[0].text;
                texto = texto.replace(/```json\n?/g, '').replace(/```/g, '').trim();
                
                const jsonMatch = texto.match(/\{[\s\S]*?\}/);
                if (jsonMatch) texto = jsonMatch[0];
                
                const datos = JSON.parse(texto);
                console.log('✅ Datos detectados por IA:', datos);
                
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
                
                // Incrementar contador silenciosamente
                peticionesHoy++;
                localStorage.setItem('gemini_count', peticionesHoy.toString());
                
                if (camposCompletos > 0) {
                    alert('✅ Detectados ' + camposCompletos + ' de 4 campos:\n\n' + 
                          detectados.join('\n') + '\n\n' +
                          '👀 Revisa los datos antes de guardar');
                } else {
                    alert('⚠️ No se pudieron detectar datos.\n\nIntroduce los datos manualmente.');
                }
            } else {
                alert('⚠️ No se pudo analizar la factura.\n\nIntroduce los datos manualmente.');
            }
            
        } catch (error) {
            console.error('Error:', error);
            const loadingMsg = document.getElementById('loading-ia');
            if (loadingMsg) document.body.removeChild(loadingMsg);
            
            alert('⚠️ No se pudo analizar la factura.\n\nIntroduce los datos manualmente.');
        }
    };
    reader.readAsDataURL(file);
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
        alert('✅ Factura guardada correctamente\n\n📊 Total de facturas: ' + invoices.length);
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
            '<div class="empty-state">No se encontraron facturas con "' + searchTerm + '"</div>' :
            '<div class="empty-state">No hay facturas guardadas.<br>¡Añade tu primera factura!</div>';
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
console.log('✅ Gestor de Facturas PRO - IA Gemini activada');
