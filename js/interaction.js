/**
 * ConSySenci.a Rosa — interaction.js
 * Lógica de Interação: Detecção de Long-Press no Botão Power
 *
 * Responsável por:
 *   - Capturar eventos de pointer (mouse, touch, stylus) no btn-power
 *   - Gerenciar timer de 3 segundos com requestAnimationFrame
 *   - Validar duração do press e disparar transições de estado
 *   - Prevenir cliques múltiplos acidentais (debounce de segurança)
 *   - Fornecer feedback progressivo visual durante o press
 *
 * © 2026 ConSySenci.a — Todos os direitos reservados
 */

'use strict';

const InteractionController = (() => {

  // ── Configurações ─────────────────────────────────────────
  const CONFIG = Object.freeze({
    LONG_PRESS_DURATION_MS: 3000,  // 3 segundos exatos
    FEEDBACK_HIDE_DELAY_MS: 2200,  // tempo para esconder mensagem de erro
    INDICATOR_TICK_MS:      80,    // intervalo de atualização da barra (rAF)
    DEBOUNCE_LOCK_MS:       400,   // cooldown após soltar o botão
  });

  // ── Estado interno da interação ───────────────────────────
  let _pressStartTime   = null;   // timestamp do início do press
  let _isPressed        = false;  // botão está sendo segurado?
  let _rafId            = null;   // ID do requestAnimationFrame
  let _feedbackTimer    = null;   // timer para esconder feedback de erro
  let _debounceLocked   = false;  // lock anti-clique-acidental
  let _activePointerId  = null;   // ID do pointer capturado

  // ── Referências DOM (injetadas em init) ──────────────────
  let _btnPower       = null;
  let _onSuccess      = null;  // callback quando long-press é concluído
  let _onEarlyRelease = null;  // callback quando solto antes do tempo

  // ── Lógica do RAF: atualiza indicador de progresso ───────
  const _rafLoop = (timestamp) => {
    if (!_isPressed || _pressStartTime === null) return;

    const elapsed  = timestamp - _pressStartTime;
    const progress = Math.min(elapsed / CONFIG.LONG_PRESS_DURATION_MS, 1);

    // Atualiza UI via callback (separação de responsabilidades)
    if (typeof window.SimulatorUI?.updateLongPressIndicator === 'function') {
      window.SimulatorUI.updateLongPressIndicator(progress);
    }

    if (elapsed >= CONFIG.LONG_PRESS_DURATION_MS) {
      // ✅ Long-press concluído!
      _handleSuccess();
      return;
    }

    // Continua o loop
    _rafId = requestAnimationFrame(_rafLoop);
  };

  // ── Início do press ───────────────────────────────────────
  const _handlePressStart = (event) => {
    // Ignora se já pressionado, em boot, ou em debounce
    if (_isPressed || _debounceLocked) return;
    if (!window.SimulatorState?.is(window.SimulatorState.STATES.OFF)) return;

    // Previne comportamento padrão (scroll, zoom, context menu)
    event.preventDefault();

    // Captura o pointer para receber eventos mesmo fora do elemento
    if (event.pointerId !== undefined) {
      _activePointerId = event.pointerId;
      try {
        _btnPower.setPointerCapture(_activePointerId);
      } catch (e) {
        // Silencioso — alguns browsers podem rejeitar em certos contextos
      }
    }

    _isPressed = true;
    _pressStartTime = performance.now();

    // Transição de estado: OFF → PRESSING
    window.SimulatorState.transition(window.SimulatorState.STATES.PRESSING);

    // Inicia loop de RAF
    _rafId = requestAnimationFrame(_rafLoop);
  };

  // ── Fim do press (solto antes do tempo) ──────────────────
  const _handlePressEnd = (event) => {
    if (!_isPressed) return;

    // Valida que é o mesmo pointer que iniciou
    if (event.pointerId !== undefined && event.pointerId !== _activePointerId) return;

    const elapsed = performance.now() - _pressStartTime;

    _cleanupPress();

    // Só mostra erro se foi solto ANTES do tempo (não após sucesso)
    if (window.SimulatorState?.is(window.SimulatorState.STATES.PRESSING)) {
      // Volta ao estado OFF
      window.SimulatorState.transition(window.SimulatorState.STATES.OFF);
      // Feedback de "segurou pouco"
      if (typeof _onEarlyRelease === 'function') {
        _onEarlyRelease(elapsed);
      }
    }
  };

  // ── Long-press concluído com sucesso ─────────────────────
  const _handleSuccess = () => {
    _cleanupPress();

    // Dispara transição para BOOTING
    const ok = window.SimulatorState.transition(window.SimulatorState.STATES.BOOTING);

    if (ok && typeof _onSuccess === 'function') {
      _onSuccess();
    }
  };

  // ── Limpeza do estado de press ────────────────────────────
  const _cleanupPress = () => {
    _isPressed = false;
    _pressStartTime = null;
    _activePointerId = null;

    // Cancela RAF pendente
    if (_rafId !== null) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }

    // Ativa debounce lock para prevenir cliques acidentais
    _debounceLocked = true;
    setTimeout(() => {
      _debounceLocked = false;
    }, CONFIG.DEBOUNCE_LOCK_MS);

    // Reseta indicador visual
    if (typeof window.SimulatorUI?.updateLongPressIndicator === 'function') {
      window.SimulatorUI.updateLongPressIndicator(0);
    }
  };

  // ── Previne scroll/zoom durante interação ─────────────────
  const _handlePointerMove = (event) => {
    if (_isPressed) {
      event.preventDefault();
    }
  };

  // ── Inicialização ─────────────────────────────────────────
  const init = ({ btnPower, onSuccess, onEarlyRelease }) => {
    _btnPower       = btnPower;
    _onSuccess      = onSuccess;
    _onEarlyRelease = onEarlyRelease;

    if (!_btnPower) {
      console.error('[Interaction] Elemento btn-power não encontrado.');
      return;
    }

    // Usa PointerEvents para suportar mouse, touch e stylus uniformemente
    _btnPower.addEventListener('pointerdown', _handlePressStart, { passive: false });
    _btnPower.addEventListener('pointerup',   _handlePressEnd,   { passive: false });
    _btnPower.addEventListener('pointerleave', _handlePressEnd,  { passive: false });
    _btnPower.addEventListener('pointercancel', _handlePressEnd, { passive: false });
    _btnPower.addEventListener('pointermove', _handlePointerMove, { passive: false });

    // Previne menu de contexto em long-press mobile
    _btnPower.addEventListener('contextmenu', (e) => e.preventDefault());
  };

  // ── Destrói listeners (limpeza) ───────────────────────────
  const destroy = () => {
    if (!_btnPower) return;
    _btnPower.removeEventListener('pointerdown',  _handlePressStart);
    _btnPower.removeEventListener('pointerup',    _handlePressEnd);
    _btnPower.removeEventListener('pointerleave', _handlePressEnd);
    _btnPower.removeEventListener('pointercancel', _handlePressEnd);
    _btnPower.removeEventListener('pointermove',  _handlePointerMove);
    _cleanupPress();
  };

  // ── Retorna API ───────────────────────────────────────────
  return Object.freeze({
    init,
    destroy,
  });

})();

// Expõe globalmente
window.InteractionController = InteractionController;
