document.addEventListener('DOMContentLoaded', function() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
        let viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
            viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
        } else {
            viewportMeta = document.createElement('meta');
            viewportMeta.name = 'viewport';
            viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
            document.getElementsByTagName('head')[0].appendChild(viewportMeta);
        }
    }

    const elements = {
        menuToggleBtn: document.getElementById('menu-toggle'),
        sidebar: document.querySelector('.sidebar'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        messagesContainer: document.getElementById('messages-container'),
        chatArea: document.querySelector('.chat-area'),
        messageForm: document.querySelector('.message-form'),
        chatHeader: document.querySelector('.chat-header')
    };
    
    const BREAKPOINT_MOBILE = 768;
    const IOS_KEYBOARD_HEIGHT = 270;
    
    function toggleSidebar() {
        elements.sidebar.classList.toggle('active');
        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.classList.toggle('active');
        }
    }

    function closeSidebar() {
        elements.sidebar.classList.remove('active');
        if (elements.sidebarOverlay) {
            elements.sidebarOverlay.classList.remove('active');
        }
    }

    if (elements.menuToggleBtn) {
        elements.menuToggleBtn.addEventListener('click', toggleSidebar);
    }

    if (elements.sidebarOverlay) {
        elements.sidebarOverlay.addEventListener('click', closeSidebar);
    }
    
    const chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(item => {
        item.addEventListener('click', function() {
            if (elements.sidebar.classList.contains('active')) {
                closeSidebar();
            }
        });
    });
    
    function isMobileView() {
        return window.innerWidth <= BREAKPOINT_MOBILE;
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function adjustLayout() {
        if (!elements.messagesContainer) return;

        const messageFormHeight = elements.messageForm ? elements.messageForm.offsetHeight : 0;
        const headerHeight = elements.chatHeader ? elements.chatHeader.offsetHeight : 0;
        
        if (isMobileView()) {
            let viewportHeight = window.visualViewport ? 
                window.visualViewport.height : 
                window.innerHeight;
            
            if (isIOS && window.visualViewport && document.activeElement && 
                (document.activeElement.tagName === 'INPUT' || 
                 document.activeElement.tagName === 'TEXTAREA')) {
                
                const estimatedKeyboardHeight = window.innerHeight - window.visualViewport.height;
                
                if (estimatedKeyboardHeight > 100) {
                    viewportHeight = window.visualViewport.height;
                } else {
                    viewportHeight = window.innerHeight - 
                        (document.documentElement.classList.contains('input-focused') ? IOS_KEYBOARD_HEIGHT : 0);
                }
            }

            if (elements.chatArea) {
                elements.chatArea.classList.add('mobile-view');
                elements.chatArea.style.height = `${viewportHeight}px`;
                
                if (document.activeElement && 
                    (document.activeElement.tagName === 'INPUT' || 
                     document.activeElement.tagName === 'TEXTAREA')) {
                    elements.chatArea.style.paddingTop = '0';
                    if (elements.messagesContainer) {
                        elements.messagesContainer.style.top = '0';
                        elements.messagesContainer.style.marginTop = '0';
                    }
                } else {
                    elements.chatArea.style.paddingTop = '';
                }
            }
            
            const safetyMargin = 20;
            const availableHeight = viewportHeight - headerHeight - messageFormHeight - safetyMargin;

            elements.messagesContainer.style.height = `${availableHeight}px`;
            elements.messagesContainer.style.maxHeight = `${availableHeight}px`;
            
            if (elements.messageForm) {
                elements.messageForm.classList.add('mobile-form');
            }
        } else {
            if (elements.chatArea) {
                elements.chatArea.classList.remove('mobile-view');
                elements.chatArea.style.height = '';
            }

            elements.messagesContainer.style.height = '';
            elements.messagesContainer.style.maxHeight = '';

            if (elements.messageForm) {
                elements.messageForm.classList.remove('mobile-form');
            }
        }
        
        scrollToLatestMessage(false);
    }
    
    function scrollToLatestMessage(smooth = true) {
        if (!elements.messagesContainer || !elements.messagesContainer.lastElementChild) return;
        
        if (window.state && window.state.isLoadingMoreMessages) {
            return;
        }
        
        const isScrolledUp = elements.messagesContainer.scrollTop + elements.messagesContainer.clientHeight < 
                             elements.messagesContainer.scrollHeight - 50;
                             
        const hasInputFocus = document.activeElement && 
                             (document.activeElement.tagName === 'INPUT' || 
                              document.activeElement.tagName === 'TEXTAREA');
                              
        if (hasInputFocus || !isScrolledUp || smooth) {
            requestAnimationFrame(() => {
                elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;

                setTimeout(() => {
                    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
                }, 100);
            });
        }
    }
    
    const messagesObserver = new MutationObserver(function(mutations) {
        const hasNewMessages = mutations.some(mutation => 
            mutation.type === 'childList' && mutation.addedNodes.length > 0);
        
        if (hasNewMessages) {
            const addedOldMessages = mutations.some(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (let i = 0; i < mutation.addedNodes.length; i++) {
                        const node = mutation.addedNodes[i];

                        if (node.classList && (
                            node.classList.contains('message-old-loaded') || 
                            node.classList.contains('messages-loading-indicator') ||
                            node.classList.contains('all-messages-loaded')
                        )) {
                            return true;
                        }
                    }
                }
                return false;
            });
            
            if (!addedOldMessages) {
                scrollToLatestMessage();
                
                if (isMobileView()) {
                    adjustLayout();
                }
            }
        }
    });

    if (elements.messagesContainer) {
        messagesObserver.observe(elements.messagesContainer, { 
            childList: true
        });
    }

    function preventBounce() {
        document.body.addEventListener('touchmove', function(e) {
            if (document.activeElement && 
                (document.activeElement.tagName === 'INPUT' || 
                document.activeElement.tagName === 'TEXTAREA')) {
                if (e.touches.length === 1) {
                    e.preventDefault();
                }
            }
        }, { passive: false });
    }

    if (isIOS) {
        preventBounce();
    }

    adjustLayout();

    const debouncedAdjustLayout = debounce(adjustLayout, 150);
    window.addEventListener('resize', function() {
        debouncedAdjustLayout();
        
        if (!isMobileView()) {
            closeSidebar();
        }
    });

    window.addEventListener('orientationchange', function() {
        setTimeout(debouncedAdjustLayout, 300);
    });
    
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', function() {
            if (isMobileView()) {
                requestAnimationFrame(() => {
                    adjustLayout();
                    setTimeout(scrollToLatestMessage, 100);
                });
            }
        });
    }
    
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        if (input.type === 'text' || input.tagName === 'TEXTAREA') {
            input.setAttribute('inputmode', 'text');
            input.setAttribute('autocorrect', 'on');
            input.setAttribute('autocapitalize', 'sentences');
            
            if (isIOS) {
                input.style.fontSize = '16px';
            }
        }
        
        input.addEventListener('focus', function() {
            if (isMobileView()) {
                document.documentElement.classList.add('input-focused');
                
                if (elements.messagesContainer) {
                    elements.messagesContainer.style.top = '0';
                    elements.messagesContainer.style.marginTop = '0';
                    elements.messagesContainer.classList.add('keyboard-visible');
                }
                
                setTimeout(() => {
                    adjustLayout();
                    scrollToLatestMessage();
                    
                    if (elements.messagesContainer) {
                        elements.messagesContainer.style.top = '0';
                        elements.messagesContainer.style.marginTop = '0';
                    }

                    if (isIOS) {
                        setTimeout(() => {
                            scrollToLatestMessage(true);
                            window.scrollTo(0, 0);
                        }, 300);
                    }
                }, 200);
            }
        });

        input.addEventListener('blur', function() {
            if (isMobileView()) {
                document.documentElement.classList.remove('input-focused');
                setTimeout(() => {
                    adjustLayout();
                    scrollToLatestMessage();
                    
                    if (isIOS) {
                        window.scrollTo(0, 0);
                    }
                }, isIOS ? 300 : 200);
            }
        });
    });

    document.addEventListener('scroll', function() {
        if (isMobileView()) {
            document.body.scrollTop = 0;
            document.documentElement.scrollTop = 0;
        }
    });
    
    if (isIOS) {
        document.ontouchmove = function(e) {
            if (elements.messagesContainer) {
                const isAtTop = elements.messagesContainer.scrollTop <= 0;
                const isAtBottom = elements.messagesContainer.scrollTop + elements.messagesContainer.clientHeight >= elements.messagesContainer.scrollHeight;

                if ((isAtTop && e.touches[0].screenY > 100) || 
                    (isAtBottom && e.touches[0].screenY < window.innerHeight - 100)) {
                    if (!e.target.closest('.messages-container') || 
                        (isAtTop && document.documentElement.scrollTop === 0)) {
                        e.preventDefault();
                    }
                }
            }
        }
    }

    if (elements.chatArea) {
        elements.chatArea.addEventListener('click', function(event) {
            if ((event.target === elements.chatArea || event.target === elements.messagesContainer) && 
                elements.sidebar.classList.contains('active')) {
                closeSidebar();
            }
        });
    }

    window.addEventListener('load', function() {
        setTimeout(() => {
            adjustLayout();
            scrollToLatestMessage();
        }, 500);
    });

    document.addEventListener('touchmove', function(event) {
        if (isMobileView() && event.touches.length > 1) {
            event.preventDefault();
        }
    }, { passive: false });

    let lastTapTime = 0;
    document.addEventListener('touchend', function(e) {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        if (tapLength < 300 && tapLength > 0 && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
        lastTapTime = currentTime;
    });

    const chatList = document.querySelector('.chat-list');
    if (chatList) {
        const chatListObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    const newChatItems = document.querySelectorAll('.chat-item:not([data-listener-added="true"])');
                    newChatItems.forEach(item => {
                        item.addEventListener('click', function() {
                            if (elements.sidebar.classList.contains('active')) {
                                closeSidebar();
                            }
                        });
                        item.setAttribute('data-listener-added', 'true');
                    });
                }
            });
        });
        
        chatListObserver.observe(chatList, { 
            childList: true,
            subtree: true
        });

        chatList.addEventListener('click', function(event) {
            const chatItem = event.target.closest('.chat-item');
            
            if (chatItem && 
                !event.target.closest('.delete-chat-btn') && 
                !event.target.closest('.info-chat-btn')) {
                
                if (elements.sidebar.classList.contains('active')) {
                    closeSidebar();
                }
            }
        });
    }
    
    const sendButton = elements.messageForm ? elements.messageForm.querySelector('button[type="submit"]') : null;
    if (sendButton) {
        sendButton.addEventListener('click', function() {
            setTimeout(() => {
                scrollToLatestMessage();
            }, 300);
        });
    }

    if (elements.messageForm) {
        const messageInput = elements.messageForm.querySelector('input');
        if (messageInput) {
            messageInput.setAttribute('inputmode', 'text');
            messageInput.setAttribute('autocorrect', 'on');
            messageInput.setAttribute('autocapitalize', 'sentences');
            
            if (isIOS) {
                messageInput.style.fontSize = '16px';
            }
            
            messageInput.addEventListener('focus', function() {
                if (isMobileView()) {
                    setTimeout(() => {
                        scrollToLatestMessage();
                        messageInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        
                        if (isIOS) {
                            document.body.scrollTop = 0;
                            document.documentElement.scrollTop = 0;
                        }
                    }, 300);
                }
            });
            
            const sendButton = elements.messageForm.querySelector('button[type="submit"]');
            if (sendButton) {
                sendButton.addEventListener('click', function() {
                    messageInput.blur();
                    setTimeout(() => {
                        scrollToLatestMessage();
                    }, 300);
                });
            }
            
            if (isIOS) {
                messageInput.addEventListener('touchend', function(e) {
                    if (document.activeElement !== messageInput) {
                        e.preventDefault();
                        messageInput.focus();
                    }
                });
            }

            messageInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    if (elements.messageForm) {
                        const sendEvent = new Event('submit', {
                            cancelable: true,
                            bubbles: true
                        });
                        elements.messageForm.dispatchEvent(sendEvent);
                        messageInput.blur();
                    }
                }
            });
        }
    }
});


function setupChatPullToRefresh() {
    const state = {
        touchStartY: 0,
        touchEndY: 0,
        isPulling: false,
        refreshThreshold: 110,
        minPullToActivate: 25,
        maxPullDistance: 170,
        pullStarted: false,
        pullAllowed: false
    };
    
    let refreshIndicator = document.querySelector('.refresh-indicator');
    if (!refreshIndicator) {
        refreshIndicator = document.createElement('div');
        refreshIndicator.className = 'refresh-indicator';
        refreshIndicator.innerHTML = `
            <div class="refresh-spinner">
                <div class="spinner"></div>
            </div>
            <div class="refresh-text">Suelta para actualizar</div>
        `;
        document.body.appendChild(refreshIndicator);
    }
    
    const chatHeader = document.querySelector('.chat-header');
    const chatName = document.getElementById('current-chat-name');
    
    function isTouchInHeader(e) {
        if (!chatHeader) return false;
        
        const headerRect = chatHeader.getBoundingClientRect();
        const touchY = e.touches[0].clientY;
        const touchX = e.touches[0].clientX;
        
        return (
            touchY >= headerRect.top && 
            touchY <= headerRect.bottom && 
            touchX >= headerRect.left && 
            touchX <= headerRect.right
        );
    }

    function isTouchInTopArea(e) {
        const touchY = e.touches[0].clientY;
        const topAreaHeight = chatHeader ? chatHeader.offsetHeight : 70;
        return touchY <= topAreaHeight;
    }

    function handleTouchStart(e) {
        state.pullStarted = false;
        state.pullAllowed = false;
        
        if (isTouchInHeader(e) || isTouchInTopArea(e)) {
            state.touchStartY = e.touches[0].clientY;
            state.pullAllowed = true;
            
            if (chatHeader) {
                chatHeader.classList.add('pull-highlight');
            }
        } else {
            state.touchStartY = 0;
        }
    }

    function handleTouchMove(e) {
        if (state.touchStartY === 0 || !state.pullAllowed) return;
        
        state.touchEndY = e.touches[0].clientY;
        const distance = state.touchEndY - state.touchStartY;
        
        if (distance > state.minPullToActivate) {
            if (!state.pullStarted && distance < state.minPullToActivate) {
                return;
            }
            
            if (!state.pullStarted && distance >= state.minPullToActivate) {
                state.pullStarted = true;
            }
            
            state.isPulling = true;
            
            const resistedDistance = Math.min(distance * 0.4, state.maxPullDistance);
            
            if (resistedDistance > state.minPullToActivate) {
                refreshIndicator.style.opacity = Math.min((resistedDistance - state.minPullToActivate) / state.refreshThreshold, 0.99);
                refreshIndicator.style.transform = `translateY(${(resistedDistance - state.minPullToActivate) * 0.6}px)`;

                if (resistedDistance > state.refreshThreshold) {
                    refreshIndicator.classList.add('ready');
                    refreshIndicator.querySelector('.refresh-text').textContent = 'Suelta para actualizar';
                } else {
                    refreshIndicator.classList.remove('ready');
                    refreshIndicator.querySelector('.refresh-text').textContent = 'Desliza para actualizar';
                }
            } else {
                refreshIndicator.style.opacity = '0';
                refreshIndicator.style.transform = 'translateY(0)';
            }

            if (distance > state.minPullToActivate && e.cancelable) {
                e.preventDefault();
            }
        }
    }
    
    function handleTouchEnd() {
        if (chatHeader) {
            chatHeader.classList.remove('pull-highlight');
        }
        
        if (!state.isPulling || !state.pullStarted) {
            resetPullState();
            return;
        }
        
        const distance = state.touchEndY - state.touchStartY;
        const resistedDistance = Math.min(distance * 0.4, state.maxPullDistance);

        if (resistedDistance > state.refreshThreshold) {
            refreshIndicator.classList.add('refreshing');
            refreshIndicator.style.transform = `translateY(${state.minPullToActivate + (state.refreshThreshold * 0.6)}px)`;
            refreshIndicator.querySelector('.refresh-text').textContent = 'Actualizando...';
            
            if (typeof cleanupEverything === 'function') {
                try {
                    cleanupEverything();
                } catch (e) {
                    console.log('Error en limpieza:', e);
                }
            }

            window.isExplicitRefresh = true;
            setTimeout(() => {
                location.reload();
            }, 700);
        } else {
            resetPullState();
        }
    }
    
    function resetPullState() {
        refreshIndicator.style.transform = 'translateY(0)';
        refreshIndicator.style.opacity = '0';
        refreshIndicator.classList.remove('ready');
        
        if (chatHeader) {
            chatHeader.classList.remove('pull-highlight');
        }
        
        state.isPulling = false;
        state.pullStarted = false;
        state.pullAllowed = false;
    }
    
    function handleTouchCancel() {
        resetPullState();
    }

    if (chatHeader) {
        chatHeader.addEventListener('touchstart', handleTouchStart, { passive: true });
        chatHeader.addEventListener('touchmove', handleTouchMove, { passive: false });
        chatHeader.addEventListener('touchend', handleTouchEnd, { passive: true });
        chatHeader.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    }
    
    if (chatName) {
        chatName.addEventListener('touchstart', handleTouchStart, { passive: true });
        chatName.addEventListener('touchmove', handleTouchMove, { passive: false });
        chatName.addEventListener('touchend', handleTouchEnd, { passive: true });
        chatName.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true });
}

function initPullToRefresh() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setupChatPullToRefresh();
    } else {
        document.addEventListener('DOMContentLoaded', setupChatPullToRefresh);
    }
}

initPullToRefresh();