// Base de datos local
let invoices = JSON.parse(localStorage.getItem('invoices')) || [];
let currentPhoto = null;
let modoManual = false;

// Gemini API Key
const GEMINI_API_KEY = 'AIzaSyCKdb9YfWi23ZraEQ6PE_MgyEaw9x1s4g8';

// Google Drive API
const GOOGLE_CLIENT_ID = 'TU_CLIENT_ID_AQUI.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'TU_API_KEY_AQUI';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file';

let googleAccessToken = null;

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

// Menú
const menuBtn = document.getElementById('menu-btn');
const menuOverlay = document.getElementById('menu-overlay');
const menuPanel = document.getElementById('menu-panel');
const menuClose = document.getElementById('menu-close');

// Abrir/cerrar menú
if (menuBtn && menuOverlay && menuPanel) {
    menuBtn.addEventListener('click', function() {
        menuOverlay.classList.add('active');
        menuPanel.classList.add('active');
    });
    
    menuClose.addEventListener('click', closeMenu);
    menuOverlay.addEventListener('click', closeMenu);
}

function closeMenu() {
    if (menuOverlay && menuPanel) {
        menuOverlay.classList.remove('active');
        menuPanel.classList.remove('active');
    }
}

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
        const input = garantiaCustom.querySelector('input');
        if (input) input.setAttribute('required', '');
    } else {
        garantiaCustom.style.display = 'none';
        const input = garantiaCustom.querySelector('input');
        if (input) input.removeAttribute('required');
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
    if (!file) return;
    
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
            const base64Image = currentPhoto.split(',')[1];
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: `Analiza esta factura/ticket y extrae EXACTAMENTE estos datos en formato JSON.

IMPORTANTE: Tickets de supermercado, gasolineras, restaurantes, etc. también son válidos.

EXTRAE:
1. TOTAL: Importe final (el número más grande, con IVA)
2. FECHA: Formato DD/MM/YYYY
3. COMERCIO: Nombre de la tienda (Mercadona, Repsol, Amazon, etc.)
4. ARTÍCULOS: Array con TODOS los productos. Si no se distinguen productos individuales, pon ["Compra general"]
5. CATEGORÍA: alimentacion, tecnologia, electrodomesticos, ropa, hogar, transporte, suministros, salud, ocio, deportes, educacion, mascotas, belleza, servicios, otros

Responde SOLO con JSON (sin markdown):
{
  "total": "45.67",
  "fecha": "10/11/2025",
  "comercio": "Mercadona",
  "articulos": ["Compra semanal"],
  "categoria": "alimentacion"
}

Si no encuentras algo, usa null o [].`
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
                        maxOutputTokens: 500,
                    }
                })
            });
            
            const loadingMsg = document.getElementById('loading-ia');
            if (loadingMsg) document.body.removeChild(loadingMsg);
            
            if (!response.ok) throw new Error(`Error: ${response.status}`);
            
            const data = await response.json();
            
            if (data.candidates && data.candidates[0].content) {
                const texto = data.candidates[0].content.parts[0].text;
                let jsonText = texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
                if (jsonMatch) jsonText = jsonMatch[0];
                
                const datosFactura = JSON.parse(jsonText);
                let datosDetectados = [];
                
                // Rellenar campos
                if (datosFactura.total) {
                    document.getElementById('importe').value = String(datosFactura.total).replace(',', '.');
                    datosDetectados.push('💰 Total: ' + datosFactura.total + '€');
                }
                
                if (datosFactura.fecha) {
                    const partes = datosFactura.fecha.split('/');
                    if (partes.length === 3) {
                        fechaCalendario.value = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
                        datosDetectados.push('📅 Fecha: ' + datosFactura.fecha);
                    }
                }
                
                if (datosFactura.comercio) {
                    document.getElementById('comercio').value = datosFactura.comercio;
                    datosDetectados.push('🏪 Comercio: ' + datosFactura.comercio);
                }
                
                if (datosFactura.articulos && datosFactura.articulos.length > 0) {
                    document.getElementById('articulos').value = datosFactura.articulos.join(', ');
                    datosDetectados.push('📦 Artículos detectados');
                }
                
                if (datosFactura.categoria) {
                    document.getElementById('categoria').value = datosFactura.categoria;
                    
                    // Garantía automática
                    if (datosFactura.categoria === 'tecnologia' || datosFactura.categoria === 'electrodomesticos') {
                        document.getElementById('garantia-tipo').value = '3';
                        datosDetectados.push('✅ Garantía: 3 años 🇪🇸');
                    }
                }
                
                if (datosDetectados.length > 0) {
                    alert('✅ Datos detectados:\n\n' + datosDetectados.join('\n'));
                } else {
                    alert('⚠️ No se detectaron datos. Introdúcelos manualmente.');
                }
            }
            
        } catch (error) {
            const loadingMsg = document.getElementById('loading-ia');
            if (loadingMsg) document.body.removeChild(loadingMsg);
            
            console.error('Error:', error);
            alert('❌ Error al analizar. Introduce los datos manualmente.');
        }
    };
    
    reader.readAsDataURL(file);
}
// Guardar factura
form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    try {
        // Obtener fecha
        let fecha, fechaISO;
        if (modoManual) {
            fecha = fechaManual.value;
            if (!fecha || fecha.length < 10) {
                alert('❌ Formato de fecha incorrecto. Usa DD/MM/AAAA');
                return;
            }
            const partes = fecha.split('/');
            fechaISO = `${partes[2]}-${partes[1]}-${partes[0]}`;
        } else {
            fechaISO = fechaCalendario.value;
            if (!fechaISO) {
                alert('❌ Debes seleccionar una fecha');
                return;
            }
            const fechaObj = new Date(fechaISO);
            const dia = String(fechaObj.getDate()).padStart(2, '0');
            const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
            fecha = `${dia}/${mes}/${fechaObj.getFullYear()}`;
        }
        
        // Calcular garantía
        let garantiaHasta = '';
        const garantiaTipo = document.getElementById('garantia-tipo').value;
        
        if (garantiaTipo === 'custom') {
            garantiaHasta = document.getElementById('garantia-custom-date').value;
        } else if (garantiaTipo) {
            garantiaHasta = calcularGarantia(fechaISO, garantiaTipo);
        }
        
        // Garantía extendida
        const garantiaExtNombre = document.getElementById('garantia-ext-nombre').value;
        const garantiaExtAnos = document.getElementById('garantia-ext-anos').value;
        let garantiaExtVence = '';
        
        if (garantiaExtAnos && parseInt(garantiaExtAnos) > 0) {
            const añosTotal = (parseInt(garantiaTipo) || 0) + parseInt(garantiaExtAnos);
            garantiaExtVence = calcularGarantia(fechaISO, añosTotal);
        }
        
        // Artículos
        const articulosTexto = document.getElementById('articulos').value || '';
        const articulosArray = articulosTexto.split(',').map(art => art.trim()).filter(art => art.length > 0);
        
        // Crear factura
        const invoice = {
            id: Date.now(),
            fecha: fecha,
            importe: parseFloat(document.getElementById('importe').value) || 0,
            comercio: document.getElementById('comercio').value || 'Sin comercio',
            articulos: articulosArray,
            categoria: document.getElementById('categoria').value || 'otros',
            garantia: garantiaHasta,
            garantiaTipo: garantiaTipo,
            garantiaExtendida: garantiaExtNombre || null,
            garantiaExtAnos: garantiaExtAnos ? parseInt(garantiaExtAnos) : 0,
            garantiaExtVence: garantiaExtVence || null,
            photo: currentPhoto,
            timestamp: new Date().toISOString()
        };
        
        invoices.unshift(invoice);
        localStorage.setItem('invoices', JSON.stringify(invoices));
        
        // Limpiar
        form.reset();
        photoPreview.style.display = 'none';
        currentPhoto = null;
        toggleGarantiaPersonalizada();
        
        renderInvoices();
        alert('✅ Factura guardada');
        
    } catch (error) {
        console.error(error);
        alert('❌ Error al guardar');
    }
});
// Mostrar facturas
function renderInvoices(searchTerm = '') {
    count.textContent = invoices.length;
    
    let facturasAMostrar = invoices;
    if (searchTerm) {
        facturasAMostrar = invoices.filter(function(invoice) {
            const comercio = (invoice.comercio || '').toLowerCase();
            const articulos = (invoice.articulos || []).join(' ').toLowerCase();
            const concepto = (invoice.concepto || '').toLowerCase();
            return comercio.includes(searchTerm) || articulos.includes(searchTerm) || concepto.includes(searchTerm);
        });
    }
    
    if (facturasAMostrar.length === 0) {
        if (searchTerm) {
            invoiceList.innerHTML = '<div class="empty-state">No se encontraron facturas con "' + searchTerm + '"</div>';
        } else {
            invoiceList.innerHTML = '<div class="empty-state">No hay facturas guardadas.<br>¡Añade tu primera factura!</div>';
        }
        checkWarrantyWarnings();
        return;
    }
    
    invoiceList.innerHTML = facturasAMostrar.map(function(invoice) {
        const comercio = invoice.comercio || '';
        const articulos = invoice.articulos || [];
        const concepto = invoice.concepto || '';
        
        let displayText = comercio;
        
        // Mostrar artículos
        let articulosHTML = '';
        if (articulos.length > 0) {
            if (articulos.length === 1) {
                displayText = comercio + ' - ' + articulos[0];
            } else {
                displayText = comercio;
                articulosHTML = '<div class="productos-toggle" onclick="toggleProductos(' + invoice.id + ')">' +
                    '📦 ' + articulos.length + ' productos ▼' +
                '</div>' +
                '<div class="productos-expandido" id="productos-' + invoice.id + '" style="display: none;">' +
                    '<ul>' + articulos.map(art => '<li>• ' + art + '</li>').join('') + '</ul>' +
                '</div>';
            }
        } else if (concepto) {
            displayText = concepto;
        }
        
        // Garantías
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
                garantiaHTML = '<div style="color: ' + garantiaColor + '; font-size: 0.9em; margin-top: 5px;">' + garantiaIcono + ' Garantía legal caducada</div>';
            } else if (diasRestantes < 90) {
                garantiaColor = '#ff6b6b';
                garantiaIcono = '⚠️';
                garantiaHTML = '<div style="color: ' + garantiaColor + '; font-size: 0.9em; margin-top: 5px;">' + garantiaIcono + ' Garantía legal: ' + formatearFecha(invoice.garantia) + ' (' + diasRestantes + ' días)</div>';
            } else {
                garantiaHTML = '<div style="color: ' + garantiaColor + '; font-size: 0.9em; margin-top: 5px;">' + garantiaIcono + ' Garantía legal: ' + formatearFecha(invoice.garantia) + ' 🇪🇸</div>';
            }
        }
        
        // Garantía extendida
        if (invoice.garantiaExtendida && invoice.garantiaExtVence) {
            const extFecha = new Date(invoice.garantiaExtVence);
            const hoy = new Date();
            const diasRestantes = Math.floor((extFecha - hoy) / (1000 * 60 * 60 * 24));
            
            if (diasRestantes >= 0) {
                garantiaHTML += '<div style="color: #4facfe; font-size: 0.9em; margin-top: 3px;">🛡️ ' + invoice.garantiaExtendida + ': ' + formatearFecha(invoice.garantiaExtVence) + '</div>';
            }
        }
        
        // Imagen
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
            '<div><strong>' + displayText + '</strong></div>' +
            articulosHTML +
            garantiaHTML +
            imagenHTML +
        '</div>';
    }).join('');
    
    checkWarrantyWarnings();
}

// Toggle productos
function toggleProductos(id) {
    const productosDiv = document.getElementById('productos-' + id);
    if (productosDiv) {
        if (productosDiv.style.display === 'none') {
            productosDiv.style.display = 'block';
        } else {
            productosDiv.style.display = 'none';
        }
    }
}

// Toggle imagen
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
    if (confirm('¿Eliminar esta factura?')) {
        invoices = invoices.filter(function(inv) { 
            return inv.id !== id; 
        });
        localStorage.setItem('invoices', JSON.stringify(invoices));
        renderInvoices();
    }
}
// Funciones del menú
function showAbout() {
    closeMenu();
    alert(`📱 DocuScan Pro v2.0

Aplicación de gestión de facturas con IA

✨ Características:
- Escaneo automático con Gemini AI
- Detección de múltiples productos
- Garantías automáticas según ley española
- Garantías extendidas (AppleCare, etc.)
- Búsqueda inteligente
- Almacenamiento local seguro

👨‍💻 Desarrollado por David
🏢 GPInformático
📧 Contacto: gpinformatico.com

© 2025 Todos los derechos reservados`);
}

function showLegal() {
    closeMenu();
    alert(`⚖️ AVISO LEGAL

RESPONSABILIDAD
Esta aplicación se proporciona "tal cual" sin garantías. El usuario es responsable de verificar la exactitud de los datos detectados por la IA.

PRIVACIDAD
- Todos los datos se almacenan localmente en tu dispositivo
- No se envía información a servidores externos
- Las imágenes de facturas se procesan mediante Gemini AI
- Puedes eliminar todos tus datos en cualquier momento

GARANTÍAS
La información sobre garantías legales es orientativa. Consulta la legislación vigente y los términos específicos de cada producto.

LEY DE GARANTÍAS EN ESPAÑA
Según el Real Decreto Legislativo 1/2007:
- Productos de consumo: mínimo 3 años
- Electrodomésticos y tecnología: 3 años recomendados

Para más información: gpinformatico.com`);
}

function exportData() {
    closeMenu();
    if (invoices.length === 0) {
        alert('❌ No hay facturas para exportar');
        return;
    }
    
    const dataStr = JSON.stringify(invoices, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'facturas_backup_' + new Date().toISOString().split('T')[0] + '.json';
    link.click();
    URL.revokeObjectURL(url);
    
    alert('✅ Datos exportados correctamente');
}

function importData() {
    closeMenu();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const importedData = JSON.parse(event.target.result);
                    if (Array.isArray(importedData)) {
                        if (confirm('¿Deseas REEMPLAZAR todas las facturas actuales o AÑADIR las importadas?\n\nOK = Añadir\nCancelar = Reemplazar')) {
                            invoices = invoices.concat(importedData);
                        } else {
                            invoices = importedData;
                        }
                        localStorage.setItem('invoices', JSON.stringify(invoices));
                        renderInvoices();
                        alert('✅ Datos importados correctamente: ' + importedData.length + ' facturas');
                    } else {
                        alert('❌ Formato de archivo inválido');
                    }
                } catch (error) {
                    alert('❌ Error al importar: archivo corrupto');
                }
            };
            reader.readAsText(file);
        }
    };
    
    input.click();
}

function deleteAllData() {
    closeMenu();
    if (confirm('⚠️ ¿ELIMINAR TODAS LAS FACTURAS?\n\nEsta acción NO se puede deshacer.\n\nTe recomendamos exportar tus datos primero.')) {
        if (confirm('¿Estás COMPLETAMENTE seguro?\n\nSe eliminarán ' + invoices.length + ' facturas.')) {
            localStorage.removeItem('invoices');
            invoices = [];
            renderInvoices();
            alert('✅ Todas las facturas han sido eliminadas');
        }
    }
}

// Avisos de garantías
function checkWarrantyWarnings() {
    const warningsSection = document.getElementById('warnings-section');
    const warningsList = document.getElementById('warnings-list');
    const warningBadge = document.getElementById('warning-badge');
    const warningCount = document.getElementById('warning-count');
    
    if (!warningsSection) return;
    
    const hoy = new Date();
    const warnings = [];
    
    invoices.forEach(function(invoice) {
        if (invoice.garantia) {
            const garantiaFecha = new Date(invoice.garantia);
            const diasRestantes = Math.floor((garantiaFecha - hoy) / (1000 * 60 * 60 * 24));
            
            if (diasRestantes >= 0 && diasRestantes <= 90) {
                warnings.push({
                    id: invoice.id,
                    tipo: 'legal',
                    comercio: invoice.comercio,
                    articulos: invoice.articulos,
                    dias: diasRestantes,
                    fecha: invoice.garantia,
                    urgente: diasRestantes <= 30
                });
            }
        }
        
        if (invoice.garantiaExtendida && invoice.garantiaExtVence) {
            const extFecha = new Date(invoice.garantiaExtVence);
            const diasRestantes = Math.floor((extFecha - hoy) / (1000 * 60 * 60 * 24));
            
            if (diasRestantes >= 0 && diasRestantes <= 90) {
                warnings.push({
                    id: invoice.id,
                    tipo: 'extendida',
                    nombre: invoice.garantiaExtendida,
                    comercio: invoice.comercio,
                    articulos: invoice.articulos,
                    dias: diasRestantes,
                    fecha: invoice.garantiaExtVence,
                    urgente: diasRestantes <= 30
                });
            }
        }
    });
    
    if (warnings.length > 0) {
        warningsSection.style.display = 'block';
        warningBadge.style.display = 'block';
        warningCount.textContent = warnings.length;
        
        warnings.sort(function(a, b) {
            return a.dias - b.dias;
        });
        
        warningsList.innerHTML = warnings.map(function(warning) {
            const articulo = warning.articulos && warning.articulos.length > 0 
                ? warning.articulos[0] 
                : warning.comercio;
            
            let urgencyClass = '';
            let icon = '⚠️';
            let urgencyText = '';
            
            if (warning.dias <= 7) {
                urgencyClass = 'urgent';
                icon = '🔴';
                urgencyText = '¡MUY URGENTE!';
            } else if (warning.dias <= 30) {
                urgencyClass = 'urgent';
                icon = '🔴';
                urgencyText = 'URGENTE';
            } else if (warning.dias <= 60) {
                urgencyClass = 'moderate';
                icon = '🟡';
                urgencyText = 'Próximamente';
            } else {
                urgencyClass = 'moderate';
                icon = '🟡';
                urgencyText = 'Aviso';
            }
            
            const tipoGarantia = warning.tipo === 'legal' 
                ? 'Garantía Legal 🇪🇸' 
                : warning.nombre;
            
            return '<div class="warning-item ' + urgencyClass + '">' +
                '<div class="warning-item-info">' +
                    '<div class="warning-item-title">' +
                        icon + ' ' + urgencyText + ' - ' + articulo +
                    '</div>' +
                    '<div class="warning-item-details">' +
                        tipoGarantia + ' • Vence: ' + formatearFecha(warning.fecha) +
                    '</div>' +
                '</div>' +
                '<div class="warning-item-days">' +
                    warning.dias + '<br><small style="font-size: 12px;">días</small>' +
                '</div>' +
            '</div>';
        }).join('');
        
    } else {
        warningsSection.style.display = 'none';
        warningBadge.style.display = 'none';
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
checkWarrantyWarnings();
