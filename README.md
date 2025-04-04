## Descripción General

ChatBasico es una aplicación de mensajería web desarrollada con HTML, CSS y JavaScript puro (sin frameworks) que se integra con Firebase para proporcionar funcionalidades de chat en tiempo real. La aplicación implementa algunas características como autenticación por correo y contraseña, cifrado de extremo a extremo, chats en tiempo real y creación de grupos con hasta 30 usuarios. <strong>Aunque todo dependera de como configures Firebase y las modificaciones que hagas al proyecto.</strong>

<img src="./Captures/1.png">

## Arquitectura del Sistema

La aplicación sigue una arquitectura modular donde cada componente se encarga de una responsabilidad específica, facilitando el mantenimiento y la extensibilidad del código. La interacción con Firebase para la autenticación y la gestión de datos en tiempo real es central para el funcionamiento de la aplicación.

## Configuración del Proyecto

Para utilizar esta aplicación, es necesario configurar Firebase y actualizar los datos de conexión:

1. **Crear un proyecto en Firebase**:
   - Accede a [Firebase Console](https://console.firebase.google.com/)
   - Crea un nuevo proyecto
   - Habilita Authentication (con email y contraseña)
   - Configura Realtime Database

2. **Actualizar la configuración**:
   - Modifica el archivo `public/js/config.js` con tus propias credenciales de Firebase:
   ```javascript
   window.firebaseConfig = {
       apiKey: "TU_API_KEY",
       authDomain: "TU_PROYECTO.firebaseapp.com",
       databaseURL: "https://TU_PROYECTO-default-rtdb.firebaseio.com",
       projectId: "TU_PROYECTO",
       storageBucket: "TU_PROYECTO.firebasestorage.app",
       messagingSenderId: "TU_MESSAGING_ID",
       appId: "TU_APP_ID",
       measurementId: "TU_MEASUREMENT_ID"
   };
   ```

3. **Configurar Reglas de Seguridad en Firebase**:
   - En la consola de Firebase, navega a Realtime Database
   - Ve a la pestaña "Reglas" y utiliza las siguientes reglas de seguridad:
   ```json
   {
     "rules": {
       ".read": "auth != null",
       ".write": "auth != null",
       "users": {
         ".read": "auth != null",
         "$uid": {
           ".write": "auth != null && auth.uid == $uid",
           "publicKey": {
             ".read": "auth != null"
           }
         }
       },
       "userKeys": {
         ".read": "auth != null",
         ".write": "auth != null",
         "$uid": {
           ".read": "auth != null",
           ".write": "auth != null && auth.uid == $uid",
           "publicKey": {
             ".read": "auth != null"
           }
         }
       },
       "userChats": {
         "$uid": {
           ".read": "auth != null && auth.uid == $uid",
           ".write": "auth != null && auth.uid == $uid"
         }
       },
       "chats": {
         ".read": "auth != null",
         ".write": "auth != null"
       },
       "chatParticipants": {
         "$chatId": {
           ".read": "auth != null && data.child(auth.uid).exists()",
           ".write": "auth != null && (data.child(auth.uid).exists() || newData.child(auth.uid).exists())"
         }
       },
       "messages": {
         "$chatId": {
           ".read": "auth != null && root.child('chatParticipants').child($chatId).child(auth.uid).exists()",
           ".write": "auth != null && root.child('chatParticipants').child($chatId).child(auth.uid).exists()",
           ".indexOn": ["timestamp"]
         }
       },
       "chatKeys": {
         "$chatId": {
           ".read": "auth != null && root.child('chatParticipants').child($chatId).child(auth.uid).exists()",
           ".write": "auth != null && root.child('chatParticipants').child($chatId).child(auth.uid).exists()",
           "$uid": {
             ".read": "auth != null && ($uid == auth.uid || root.child('chatParticipants').child($chatId).child(auth.uid).exists())",
             ".write": "auth != null && root.child('chatParticipants').child($chatId).child(auth.uid).exists()"
           }
         }
       }
     }
   }
   ```

4. **Configuración de Dominio** (opcional):
- Si deseas restringir el acceso a un dominio específico, configura las restricciones de dominio en la consola de Firebase:
     - Ve a Project Settings > General
     - En la sección "Your apps", configura los dominios autorizados

5. **Despliegue**:
- Puedes desplegar la aplicación usando Firebase Hosting o donde quieras.

## Estructura del Proyecto

```
├── index.html                  # Punto de entrada de la aplicación
├── css/
│   └── styles.css              # Estilos de la aplicación
├── js/
│   ├── app.js                  # Inicialización de la aplicación
│   ├── auth.js                 # Gestión de autenticación
│   ├── chat-core.js            # Núcleo del sistema de chat
│   ├── chat-encryption.js      # Integración con el sistema de cifrado
│   ├── chat-firebase.js        # Interacción con Firebase
│   ├── chat-import.js          # Gestor de importación de módulos
│   ├── chat-messages.js        # Manejo de mensajes
│   ├── chat-participants.js    # Gestión de participantes y grupos
│   ├── chat-ui.js              # Interfaz de usuario del chat
│   ├── chat-utils.js           # Utilidades generales
│   ├── config.js               # Configuración de Firebase
│   ├── crypto-utils.js         # Utilidades de cifrado
│   ├── firebase-init.js        # Inicialización de Firebase
│   └── responsive.js           # Adaptación a diferentes dispositivos
```

## Descripción de los "módulos"

### 1. `app.js`

Este archivo es el punto de inicialización de la aplicación. Se encarga de verificar que Firebase se haya cargado correctamente y prepara el entorno para la ejecución de la aplicación.

```javascript
document.addEventListener('DOMContentLoaded', () => {
    console.log('Aplicación de chat inicializada');
    
    if (typeof firebase === 'undefined') {
        console.error('Firebase no está cargado correctamente');
        alert('Error al cargar contenido del servidor...');
    }
});
```

### 2. `auth.js`

Gestiona toda la lógica de autenticación de usuarios, incluyendo:

- Registro de nuevos usuarios con email y contraseña
- Inicio de sesión de usuarios existentes
- Generación y almacenamiento seguro de claves criptográficas por usuario
- Cierre de sesión y limpieza de datos locales
- Cambio entre formularios de inicio de sesión y registro
- Gestión del estado de autenticación en tiempo real

El módulo utiliza Firebase Authentication para la gestión de usuarios y se integra con `crypto-utils.js` para generar y almacenar claves de seguridad para el cifrado de mensajes.

### 3. `chat-core.js`

Es el núcleo del sistema de chat y contiene:

- Definición de constantes y configuración global
- Gestión del estado de la aplicación
- Referencias a elementos DOM importantes
- Referencias a rutas de Firebase
- Función principal de inicialización del chat
- Función de limpieza para la desconexión

Este módulo actúa como coordinador central entre los diferentes componentes del sistema de chat y proporciona acceso a recursos compartidos.

### 4. `chat-encryption.js`

Proporciona una interfaz para interactuar con el sistema de cifrado de extremo a extremo:

- Inicialización del sistema de cifrado
- Gestión de claves de usuario y claves de chat
- Encriptación y desencriptación de mensajes
- Compartición segura de claves entre usuarios
- Verificación de compatibilidad del navegador con Web Crypto API

Este módulo se integra con `crypto-utils.js` para realizar las operaciones criptográficas efectivas, actuando como un adaptador que simplifica su uso en el contexto del chat.

### 5. `chat-firebase.js`

Maneja todas las interacciones con Firebase Realtime Database:

- Cálculo y gestión de mensajes no leídos
- Marcado de chats como leídos
- Almacenamiento y carga del estado de lectura
- Verificación periódica de contadores de mensajes no leídos
- Configuración de listeners para nuevos mensajes
- Renderización de la lista de chats
- Gestión eficiente de conexiones a Firebase

Este módulo proporciona una capa de abstracción sobre las operaciones directas de Firebase, facilitando el mantenimiento y la reutilización del código.

### 6. `chat-import.js`

Gestiona la carga ordenada de los módulos del chat:

- Carga secuencial de scripts basada en dependencias
- Prevención de problemas de carga asincrónica
- Control de errores durante la carga
- Inicialización coordinada una vez que todos los módulos están disponibles

Este módulo asegura que los diferentes componentes del sistema se carguen en el orden correcto, evitando errores por dependencias no disponibles.

### 7. `chat-messages.js`

Gestiona toda la lógica relacionada con los mensajes:

- Envío de mensajes con cifrado
- Configuración de listeners para recepción de nuevos mensajes
- Carga inicial y paginada de mensajes históricos
- Creación y renderizado de elementos de mensaje en el DOM
- Formateo de contenido (detección de URLs, emojis)
- Gestión del scroll automático
- Indicadores de carga y estado

Este módulo es responsable de toda la experiencia de mensajería, desde el envío hasta la visualización de mensajes.

### 8. `chat-participants.js`

Maneja la gestión de participantes y grupos:

- Creación de nuevas conversaciones
- Adición de usuarios a conversaciones existentes
- Visualización de información de chats
- Gestión de salida de usuarios de chats
- Eliminación de conversaciones
- Carga y filtrado de usuarios disponibles
- Administración de permisos según el rol (creador vs. participante)

Este módulo facilita la colaboración entre múltiples usuarios y la gestión de conversaciones grupales.

### 9. `chat-ui.js`

Gestiona la interfaz de usuario del chat:

- Visualización de estados (chat seleccionado, sin mensajes)
- Gestión de modales y diálogos
- Actualización de insignias de mensajes no leídos
- Configuración de eventos de UI
- Selección de conversaciones
- Confirmación de acciones destructivas

Este módulo separa la lógica de presentación de la lógica de negocio, facilitando cambios en la interfaz sin afectar la funcionalidad.

### 10. `chat-utils.js`

Proporciona utilidades generales para toda la aplicación:

- Registro de depuración
- Sanitización de entrada HTML
- Validación de entrada de mensajes
- Implementación de políticas de seguridad (CSP)
- Manejo de errores de Firebase
- Detección de contenido especial (emojis)

Este módulo contiene funciones de ayuda que son utilizadas por múltiples componentes del sistema.

### 11. `config.js`

Contiene la configuración de Firebase necesaria para conectar la aplicación con los servicios de Firebase:

```javascript
window.firebaseConfig = {
    apiKey: "...",
    authDomain: "...",
    databaseURL: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "...",
    measurementId: "..."
};
```

Este archivo se debe modificar con las credenciales específicas de tu proyecto Firebase.

### 12. `crypto-utils.js`

Implementa el sistema de cifrado de extremo a extremo:

- Conversiones entre formatos (string, ArrayBuffer, Base64)
- Generación y gestión de claves de chat (AES-GCM)
- Encriptación y desencriptación de mensajes
- Compartición segura de claves entre usuarios mediante RSA
- Generación y gestión de pares de claves por usuario
- Almacenamiento seguro de claves

Este módulo proporciona la base criptográfica para la seguridad de las comunicaciones en la aplicación.

### 13. `firebase-init.js`

Inicializa la conexión con Firebase y expone las referencias principales:

```javascript
firebase.initializeApp(window.firebaseConfig);

const auth = firebase.auth();
const database = firebase.database();

window.auth = auth;
window.database = database;
```

Este módulo centraliza la inicialización de Firebase y proporciona acceso global a los servicios de autenticación y base de datos.

### 14. `responsive.js`

Gestiona la adaptación de la interfaz a diferentes tamaños de pantalla y dispositivos:

- Gestión del teclado virtual en dispositivos móviles
- Adaptación de layouts basada en tamaño de pantalla
- Optimización de scroll y visibilidad de elementos
- Gestión de gestos táctiles (pull-to-refresh)
- Correcciones de comportamiento para diferentes navegadores

Este módulo mejora la experiencia de usuario en dispositivos móviles y asegura la consistencia en diferentes plataformas.

## Flujo de Datos

1. **Autenticación:** El usuario se registra o inicia sesión mediante `auth.js`
2. **Inicialización:** `chat-core.js` inicializa el sistema de chat y sus componentes
3. **Carga de Chats:** `chat-firebase.js` carga y muestra las conversaciones existentes
4. **Interacción:** El usuario selecciona o crea conversaciones a través de `chat-ui.js`
5. **Mensajería:** La comunicación se gestiona mediante `chat-messages.js` y se cifra utilizando `chat-encryption.js`
6. **Gestión de Grupos:** La administración de participantes se maneja con `chat-participants.js`

## Características de Seguridad

- **Autenticación básica:** Basada en Firebase Authentication
- **Cifrado de extremo a extremo:** Implementado con Web Crypto API
- **Claves específicas por chat:** Cada conversación tiene su propia clave AES-GCM
- **Compartición segura de claves:** Mediante cifrado asimétrico RSA
- **Almacenamiento local seguro:** Las claves privadas nunca salen del dispositivo
- **Validación de entrada:** Prevención de inyección de código malicioso
- **Políticas de seguridad:** Implementación de Content Security Policy

## Licencia

Este proyecto está disponible bajo licencia MIT. Consulta el archivo LICENSE para más detalles.