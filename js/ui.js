/**
 * ConSySenci.a Rosa — ui.js
 * Controlador de Interface: DOM, Transições e Sequência de Boot
 *
 * Responsável por:
 *   - Orquestrar transições entre telas (off → boot → welcome)
 *   - Sequência de boot animada com barra de progresso
 *   - Sistema de instruções externas ao celular
 *   - Feedback visual ao usuário (early release, sucesso)
 *   - Atualização do indicador de long-press
 *   - Vibração háptica visual
 *
 * © 2026 ConSySenci.a — Todos os direitos reservados
 */

'use strict';

const SimulatorUI = (() => {

  // ── Configurações de timing da sequência de boot ─────────
  const BOOT_SEQUENCE = Object.freeze([
    { delay: 0,    action: 'showBootScreen' },
    { delay: 400,  action: 'showBootLogo' },
    { delay: 1200, action: 'showBootProgress' },
    { delay: 1400, action: 'setBootProgress', value: 35 },
    { delay: 2000, action: 'setBootProgress', value: 68 },
    { delay: 2700, action: 'setBootProgress', value: 100 },
    { delay: 3100, action: 'showWelcome' },
  ]);

  // ── Textos das instruções (sistema de mensagens) ──────────
  const INSTRUCTOR_MESSAGES = Object.freeze({
    OFF: {
      arrow: true,
      text: 'Toque e <strong>segure</strong> o botão lateral por <strong>3 segundos</strong> para ligar',
    },
    PRESSING: {
      arrow: false,
      text: '✅ Isso! Continue <strong>segurando</strong>...',
    },
    EARLY_RELEASE_FAST: {   // < 1s
      arrow: true,
      text: '⚡ Muito rápido! Toque e <strong>segure firme</strong> por 3 segundos',
    },
    EARLY_RELEASE_MEDIUM: { // 1s - 2.5s
      arrow: true,
      text: '⏱️ Quase lá! Segure um <strong>pouquinho mais</strong>...',
    },
    EARLY_RELEASE_LONG: {   // > 2.5s
      arrow: true,
      text: '👏 Faltou pouco! Segure até a tela <strong>acender</strong>',
    },
    BOOTING: {
      arrow: false,
      text: '✨ Perfeito! O celular está <strong>ligando</strong>...',
    },
    WELCOME: {
      arrow: false,
      text: '🎉 Você <strong>ligou o celular!</strong> Primeiro passo concluído!',
    },
  });

  // ── Referências DOM (resolvidas em init) ─────────────────
  let _dom = {};

  // ── Timers de sequência ───────────────────────────────────
  let _bootTimers = [];
  let _feedbackTimer = null;
  let _instructorTimer = null;

  // ── Resolve todas as referências DOM ─────────────────────
  const _queryDom = () => {
    _dom = {
      phoneFrame:       document.getElementById('phone-frame'),
      btnPower:         document.getElementById('btn-power'),
      screenOff:        document.getElementById('screen-off'),
      screenBoot:       document.getElementById('screen-boot'),
      screenWelcome:    document.getElementById('screen-welcome'),
      bootLogoWrap:     document.querySelector('.boot-logo-wrap'),
      bootProgressWrap: document.querySelector('.boot-progress-wrap'),
      bootProgressFill: document.querySelector('.boot-progress-fill'),
      bootProgressLabel:document.querySelector('.boot-progress-label'),
      feedbackOverlay:  document.getElementById('feedback-overlay'),
      lpIndicator:      document.getElementById('longpress-indicator'),
      lpFill:           document.querySelector('.lp-fill'),
      instructorBubble: document.querySelector('.instructor-bubble'),
      instructorArrow:  document.querySelector('.instructor-arrow'),
      instructorText:   document.querySelector('.instructor-bubble p'),
      btnNext:          document.getElementById('btn-next'),
    };
  };

  // ── Mostra / esconde uma tela ─────────────────────────────
  const _setScreenActive = (screen, active) => {
    if (!screen) return;
    screen.classList.toggle('active', active);
  };

  // ── Atualiza a bolha de instrução ─────────────────────────
  const _setInstructor = (messageKey, delay = 0) => {
    if (_instructorTimer) {
      clearTimeout(_instructorTimer);
      _instructorTimer = null;
    }

    const applyMessage = () => {
      const msg = INSTRUCTOR_MESSAGES[messageKey];
      if (!msg || !_dom.instructorBubble) return;

      // Atualiza conteúdo
      if (_dom.instructorText) {
        _dom.instructorText.innerHTML = msg.text;
      }

      // Mostra/esconde seta
      if (_dom.instructorArrow) {
        _dom.instructorArrow.style.display = msg.arrow ? 'flex' : 'none';
      }

      // Exibe a bolha
      _dom.instructorBubble.classList.add('visible');
    };

    if (delay > 0) {
      _instructorTimer = setTimeout(applyMessage, delay);
    } else {
      applyMessage();
    }
  };

  // ── Feedback de liberação prematura ──────────────────────
  const showEarlyReleaseFeedback = (elapsedMs) => {
    if (!_dom.feedbackOverlay) return;

    // Determina severidade do feedback
    let msgKey;
    let feedbackText;

    if (elapsedMs < 1000) {
      msgKey = 'EARLY_RELEASE_FAST';
      feedbackText = 'Tente segurar um pouco mais';
    } else if (elapsedMs < 2500) {
      msgKey = 'EARLY_RELEASE_MEDIUM';
      feedbackText = 'Quase! Segure mais um pouquinho';
    } else {
      msgKey = 'EARLY_RELEASE_LONG';
      feedbackText = 'Faltou pouquinho! Tente mais uma vez';
    }

    // Vibração háptica visual no frame do celular
    if (_dom.phoneFrame) {
      _dom.phoneFrame.classList.remove('haptic');
      // Force reflow para reiniciar animação
      void _dom.phoneFrame.offsetWidth;
      _dom.phoneFrame.classList.add('haptic');
      setTimeout(() => _dom.phoneFrame?.classList.remove('haptic'), 400);
    }

    // Exibe feedback dentro da tela
    _dom.feedbackOverlay.textContent = feedbackText;
    _dom.feedbackOverlay.classList.add('visible');

    // Atualiza instrução externa
    _setInstructor(msgKey);

    // Esconde após delay
    if (_feedbackTimer) clearTimeout(_feedbackTimer);
    _feedbackTimer = setTimeout(() => {
      _dom.feedbackOverlay?.classList.remove('visible');
    }, 2000);
  };

  // ── Atualiza indicador de progresso do long-press ────────
  const updateLongPressIndicator = (progress) => {
    // progress: 0.0 → 1.0
    if (!_dom.lpFill || !_dom.lpIndicator) return;

    if (progress <= 0) {
      _dom.lpIndicator.classList.remove('visible');
      _dom.lpFill.style.height = '0%';
      return;
    }

    _dom.lpIndicator.classList.add('visible');
    _dom.lpFill.style.height = `${progress * 100}%`;
  };

  // ── Atualiza classe do botão power por estado ─────────────
  const _updateBtnPowerState = (state) => {
    if (!_dom.btnPower) return;
    _dom.btnPower.className = ''; // reset classes

    switch (state) {
      case 'OFF':
        _dom.btnPower.classList.add('state-idle');
        _dom.btnPower.setAttribute('aria-label', 'Botão Power — Toque e segure para ligar');
        _dom.btnPower.setAttribute('role', 'button');
        _dom.btnPower.setAttribute('tabindex', '0');
        break;
      case 'PRESSING':
        _dom.btnPower.classList.add('state-pressing');
        break;
      case 'BOOTING':
      case 'WELCOME':
        _dom.btnPower.classList.add('state-locked');
        _dom.btnPower.setAttribute('tabindex', '-1');
        break;
    }
  };

  // ── Sequência de Boot ─────────────────────────────────────
  const _runBootSequence = () => {
    // Limpa timers anteriores (segurança)
    _bootTimers.forEach(clearTimeout);
    _bootTimers = [];

    BOOT_SEQUENCE.forEach(({ delay, action, value }) => {
      const timer = setTimeout(() => {
        switch (action) {

          case 'showBootScreen':
            // Apaga tela OFF, acende tela de boot
            _setScreenActive(_dom.screenOff, false);
            _setScreenActive(_dom.screenBoot, true);
            break;

          case 'showBootLogo':
            if (_dom.bootLogoWrap) {
              _dom.bootLogoWrap.classList.add('visible');
            }
            break;

          case 'showBootProgress':
            if (_dom.bootProgressWrap) {
              _dom.bootProgressWrap.classList.add('visible');
            }
            break;

          case 'setBootProgress':
            if (_dom.bootProgressFill) {
              _dom.bootProgressFill.style.width = `${value}%`;
            }
            if (_dom.bootProgressLabel) {
              _dom.bootProgressLabel.textContent = `Carregando... ${value}%`;
            }
            break;

          case 'showWelcome':
            _transitionToWelcome();
            break;
        }
      }, delay);

      _bootTimers.push(timer);
    });
  };

  // ── Transição para tela de Bem-Vindo ─────────────────────
  const _transitionToWelcome = () => {
    // Transição de estado FSM
    window.SimulatorState?.transition(window.SimulatorState.STATES.WELCOME);

    // Troca de telas com overlap (fade cruzado)
    _setScreenActive(_dom.screenBoot, false);

    setTimeout(() => {
      _setScreenActive(_dom.screenWelcome, true);
    }, 300);
  };

  // ── Listener do botão "Próximo" ───────────────────────────
  const _setupNextButton = () => {
    if (!_dom.btnNext) return;

    const handleNext = (event) => {
      event.preventDefault();
      // Aqui o módulo principal pode registrar um callback externo
      if (typeof window.__onSimulatorComplete === 'function') {
        window.__onSimulatorComplete();
      } else {
        // Fallback: dispara evento customizado
        document.dispatchEvent(new CustomEvent('simulator:complete', {
          detail: { module: 'module-0-power-on' }
        }));
      }
    };

    _dom.btnNext.addEventListener('click', handleNext);
    _dom.btnNext.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') handleNext(e);
    });
  };

  // ── Reage a mudanças de estado ────────────────────────────
  const _bindStateChanges = () => {
    const { STATES, onEnter } = window.SimulatorState;

    onEnter(STATES.PRESSING, () => {
      _updateBtnPowerState('PRESSING');
      _setInstructor('PRESSING');
      // Esconde feedback de erro anterior
      _dom.feedbackOverlay?.classList.remove('visible');
    });

    onEnter(STATES.OFF, () => {
      _updateBtnPowerState('OFF');
      _setInstructor('OFF');
    });

    onEnter(STATES.BOOTING, () => {
      _updateBtnPowerState('BOOTING');
      _setInstructor('BOOTING');
      // Esconde indicador de long-press
      updateLongPressIndicator(0);
      // Roda sequência de boot
      _runBootSequence();
    });

    onEnter(STATES.WELCOME, () => {
      _updateBtnPowerState('WELCOME');
      _setInstructor('WELCOME', 600);
    });
  };

  // ── Inicialização ─────────────────────────────────────────
  const init = () => {
    _queryDom();
    _bindStateChanges();
    _setupNextButton();

    // Estado inicial: OFF
    _setScreenActive(_dom.screenOff, true);
    _setScreenActive(_dom.screenBoot, false);
    _setScreenActive(_dom.screenWelcome, false);

    _updateBtnPowerState('OFF');
    _setInstructor('OFF');

    // Inicializa bolha de instrução visível
    setTimeout(() => {
      _dom.instructorBubble?.classList.add('visible');
    }, 500);
  };

  // ── Retorna API ───────────────────────────────────────────
  return Object.freeze({
    init,
    updateLongPressIndicator,
    showEarlyReleaseFeedback,
  });

})();

// Expõe globalmente
window.SimulatorUI = SimulatorUI;
