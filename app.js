// Base de datos local
let invoices = JSON.parse(localStorage.getItem('invoices')) || [];
let currentPhoto = null;
let modoManual = false;

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

// Buscador de facturas
if (searchInput) {
    searchInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        renderInvoices(searchTerm);
    });
}

// Cambiar entre calendario y manual
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

// Auto-formato de fecha manual
fechaManual.addEventListener('input', function(e) {
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
});

// Mostrar/ocultar campo de garantía personalizada
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

// Calcular fecha de garantía
function calcularGarantia(fechaCompra, años) {
    const fecha = new Date(fechaCompra);
    fecha.setFullYear(fecha.getFullYear() + parseInt(años));
    return fecha.toISOString().split('T')[0];
}

// Procesar foto de cámara
photoCamera.addEventListener('change', async function(e) {
    await procesarFoto(e.target.files[0]);
});

// Procesar foto de galería
photoGallery.addEventListener('change', async function(e) {
    await procesarFoto(e.target.files[0]);
});

// Función para procesar foto con Gemini IA
async function procesarFoto(file) {
    if (file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            currentPhoto = e.target.result;
            photoPreview.src = currentPhoto;
            photoPreview.style.display = 'block';
            
            // Mostrar mensaje de análisis
            const mensaje = document.createElement('div');
            mensaje.id = 'loading-ia';
            mensaje.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); color: white; padding: 20px 30px; border-radius: 10px; z-index: 10000; text-align: center;';
            mensaje.innerHTML = '🤖 Analizando factura con IA...<br><small>Esto puede tardar unos segundos</small>';
            document.body.appendChild(mensaje);
            
            try {
                // Convertir imagen a base64
                const base64Image = currentPhoto.split(',')[1];
                
                // PROMPT MEJORADO para Gemini
                const promptMejorado = `Eres un experto analizando facturas y tickets españoles.

Analiza esta imagen y extrae:

1. TOTAL FINAL (IMPORTANTE: el importe CON IVA incluido, el que realmente pagó el cliente)
2. FECHA (formato DD/MM/YYYY)
3. COMERCIO (nombre de la tienda)
4. ARTÍCULO (el producto principal comprado)
5. CATEGORÍA (elige UNA de estas):

CATEGORÍAS:
- alimentacion: supermercados, comida
- tecnologia: móviles, tablets, ordenadores, auriculares
- electrodomesticos: lavadoras, neveras, microondas, aspiradoras, secadoras
- ropa: tiendas de moda, ropa, zapatos, complementos
- hogar: muebles, decoración, menaje
- transporte: gasolina, taxis
- suministros: luz, agua, gas
- salud: farmacias, médicos
- ocio: restaurantes, cine
- otros: resto

IMPORTANTE:
- Si es una LAVADORA, NEVERA o MICROONDAS → categoría: "electrodomesticos"
- Si es ROPA o ZAPATOS → categoría: "ropa"
- El TOTAL debe ser el importe FINAL CON IVA

Responde SOLO con JSON (sin markdown):
{"total":"123.45","fecha":"12/11/2025","comercio":"MediaMarkt","articulo":"Lavadora Samsung","categoria":"electrodomesticos"}

Si no encuentras algo, pon: null`;
                
                // Llamar a Gemini AI
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                {
                                    text: promptMejorado
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
                            topK: 32,
                            topP: 0.9,
                            maxOutputTokens: 800,
                        }
                    })
                });
                
                // Quitar mensaje de carga
                const loadingMsg = document.getElementById('loading-ia');
                if (loadingMsg) {
                    document.body.removeChild(loadingMsg);
                }
                
                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('Respuesta completa de Gemini:', data);
                
                if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
                    const textoRespuesta = data.candidates[0].content.parts[0].text;
                    console.log('Texto extraído:', textoRespuesta);
                    
                    // Limpiar la respuesta (quitar markdown)
                    let jsonText = textoRespuesta
                        .replace(/```json\n?/g, '')
                        .replace(/```\n?/g, '')
                        .trim();
                    
                    // Si empieza con texto, buscar el JSON
                    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        jsonText = jsonMatch[0];
                    }
                    
                    console.log('JSON limpio:', jsonText);
                    
                    try {
                        const datosFactura = JSON.parse(jsonText);
                        let datosDetectados = [];
                        
                        // Rellenar importe
                        if (datosFactura.total && datosFactura.total !== null) {
                            const importeNumerico = String(datosFactura.total).replace(',', '.');
                            document.getElementById('importe').value = importeNumerico;
                            datosDetectados.push('💰 Total: ' + importeNumerico + '€');
                        }
                        
                        // Rellenar fecha
                        if (datosFactura.fecha && datosFactura.fecha !== null) {
                            if (modoManual) {
                                fechaManual.value = datosFactura.fecha;
                            } else {
                                // Convertir dd/mm/yyyy a yyyy-mm-dd
                                const partes = datosFactura.fecha.split('/');
                                if (partes.length === 3) {
                                    const fechaISO = partes[2] + '-' + partes[1] + '-' + partes[0];
                                    fechaCalendario.value = fechaISO;
                                }
                            }
                            datosDetectados.push('📅 Fecha: ' + datosFactura.fecha);
                        }
                        
                        // Rellenar concepto
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
                        
                        // Rellenar categoría
                        if (datosFactura.categoria && datosFactura.categoria !== null) {
                            const categoriaSelect = document.getElementById('categoria');
                            const optionExists = Array.from(categoriaSelect.options).some(opt => opt.value === datosFactura.categoria);
                            if (optionExists) {
                                categoriaSelect.value = datosFactura.categoria;
                                datosDetectados.push('📦 Categoría: ' + datosFactura.categoria);
                            }
                        }
                        
                        if (datosDetectados.length > 0) {
                            alert('✅ Datos detectados por IA:\n\n' + datosDetectados.join('\n') + '\n\n👀 Verifica que sean correctos');
                        } else {
                            alert('⚠️ No se pudieron extraer datos automáticamente.\nIntrodúcelos manualmente.');
                        }
                        
                    } catch (parseError) {
                        console.error('Error parseando JSON:', parseError);
                        alert('⚠️ IA respondió pero no pudo procesar los datos.\nIntrodúcelos manualmente.');
                    }
                } else {
                    alert('⚠️ No se recibió respuesta válida de la IA.\nIntroduce los datos manualmente.');
                }
            } catch (error) {
                console.error('Error completo:', error);
                const loadingMsg = document.getElementById('loading-ia');
                if (loadingMsg) {
                    document.body.removeChild(loadingMsg);
                }
                if (error.message.includes('429')) {
                    alert('⚠️ Demasiados análisis en poco tiempo.\n\nEspera 1 minuto o introduce los datos manualmente.');
                } else if (error.message.includes('403')) {
                    alert('⚠️ Problema con la API.\nIntroduce los datos manualmente.');
                } else {
                    alert('❌ Error al conectar con la IA.\nIntroduce los datos manualmente.');
                }
            }
        };
        reader.readAsDataURL(file);
    }
}

// Guardar factura
form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Obtener fecha
    let fecha;
    let fechaISO;
    if (modoManual) {
        fecha = fechaManual.value;
        // Convertir dd/mm/yyyy a ISO
        const partes = fecha.split('/');
        fechaISO = partes[2] + '-' + partes[1] + '-' + partes[0];
    } else {
        fechaISO = fechaCalendario.value;
        const fechaObj = new Date(fechaISO);
        const dia = String(fechaObj.getDate()).padStart(2, '0');
        const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
        const año = fechaObj.getFullYear();
        fecha = dia + '/' + mes + '/' + año;
    }
    
    // Calcular garantía
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
    alert('✅ Factura guardada correctamente');
});

// Mostrar facturas
function renderInvoices(searchTerm = '') {
    count.textContent = invoices.length;
    
    // Filtrar facturas según búsqueda
    let facturasAMostrar = invoices;
    if (searchTerm) {
        facturasAMostrar = invoices.filter(function(invoice) {
            const concepto = invoice.concepto.toLowerCase();
            return concepto.includes(searchTerm);
        });
    }
    
    if (facturasAMostrar.length === 0) {
        if (searchTerm) {
            invoiceList.innerHTML = '<div class="empty-state">No se encontraron facturas con "' + searchTerm + '"</div>';
        } else {
            invoiceList.innerHTML = '<div class="empty-state">No hay facturas guardadas.<br>¡Añade tu primera factura!</div>';
        }
        return;
    }
    
    invoiceList.innerHTML = facturasAMostrar.map(function(invoice) {
        let garantiaHTML = '';
        if (invoice.garantia) {
            const garantiaFecha = new Date(invoice.garantia);
            const hoy = new Date();
            const diasRestantes = Math.floor((garantiaFecha - hoy) / (1000 * 60 * 60 * 24));
            
            let garantiaColor = '#666';
            let garantiaIcono = '⏰';
            
            if (diasRestantes < 0) {
                garantiaColor = '#999';
                garantiaIcono = '❌';
                garantiaHTML = '<div style="color: ' + garantiaColor + '; font-size: 0.9em; margin-top: 5px;">' + garantiaIcono + ' Garantía caducada</div>';
            } else if (diasRestantes < 90) {
                garantiaColor = '#ff6b6b';
                garantiaIcono = '⚠️';
                garantiaHTML = '<div style="color: ' + garantiaColor + '; font-size: 0.9em; margin-top: 5px;">' + garantiaIcono + ' Garantía hasta: ' + formatearFecha(invoice.garantia) + ' (' + diasRestantes + ' días)</div>';
            } else {
                garantiaHTML = '<div style="color: ' + garantiaColor + '; font-size: 0.9em; margin-top: 5px;">' + garantiaIcono + ' Garantía hasta: ' + formatearFecha(invoice.garantia) + '</div>';
            }
        }
        
        // Generar HTML para imagen (miniatura que se expande)
        let imagenHTML = '';
        if (invoice.photo) {
            imagenHTML = '<img src="' + invoice.photo + '" alt="Factura" class="invoice-image-preview" onclick="toggleImage(' + invoice.id + ')" id="img-preview-' + invoice.id + '">' +
                        '<img src="' + invoice.photo + '" alt="Factura completa" class="invoice-image-full" onclick="toggleImage(' + invoice.id + ')" id="img-full-' + invoice.id + '" style="display: none;">';
        }
        
        return '<div class="invoice-item">' +
            '<div class="invoice-header">' +
                '<div>' +
                    '<div class="invoice-amount">' + invoice.importe.toFixed(2) + '€</div>' +
                    '<div class="invoice-details">' +
                        getCategoryEmoji(invoice.categoria) + ' ' + (invoice.categoria || 'Sin categoría') + ' • ' + invoice.fecha +
                    '</div>' +
                '</div>' +
                '<button class="btn-delete" onclick="deleteInvoice(' + invoice.id + ')">🗑️</button>' +
            '</div>' +
            '<div><strong>' + invoice.concepto + '</strong></div>' +
            garantiaHTML +
            imagenHTML +
        '</div>';
    }).join('');
}

// Toggle de imagen (expandir/contraer)
function toggleImage(id) {
    const preview = document.getElementById('img-preview-' + id);
    const full = document.getElementById('img-full-' + id);
    
    if (preview && full) {
        if (preview.style.display === 'none') {
            preview.style.display = 'block';
            full.style.display = 'none';
        } else {
            preview.style.display = 'none';
            full.style.display = 'block';
        }
    }
}

// Eliminar factura
function deleteInvoice(id) {
    var confirmado = confirm('¿Eliminar esta factura?');
    if (confirmado) {
        invoices = invoices.filter(function(inv) { 
            return inv.id !== id; 
        });
        localStorage.setItem('invoices', JSON.stringify(invoices));
        renderInvoices();
    }
}

// Utilidades
function getCategoryEmoji(category) {
    const emojis = {
        'alimentacion': '🍔',
        'tecnologia': '📱',
        'electrodomesticos': '⚡',
        'ropa': '👕',
        'hogar': '🏠',
        'transporte': '🚗',
        'suministros': '💡',
        'salud': '🏥',
        'ocio': '🎮',
        'deportes': '🏋️',
        'educacion': '📚',
        'mascotas': '🐾',
        'belleza': '💈',
        'servicios': '🔧',
        'otros': '📦'
    };
    return emojis[category] || '📄';
}

function formatearFecha(fechaISO) {
    if (!fechaISO) return '';
    const fecha = new Date(fechaISO);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const año = fecha.getFullYear();
    return dia + '/' + mes + '/' + año;
}

// Cargar facturas al inicio
renderInvoices();
