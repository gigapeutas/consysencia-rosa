/**
 * ConSySenci.a Rosa — state.js
 * Máquina de Estados Finitos (FSM) do Simulador
 *
 * Estados possíveis:
 *   OFF        → Tela apagada, aguardando long-press no botão power
 *   PRESSING   → Usuário está segurando o botão (timer ativo)
 *   BOOTING    → Sequência de boot em andamento
 *   WELCOME    → Tela de boas-vindas exibida
 *
 * © 2026 ConSySenci.a — Todos os direitos reservados
 */

'use strict';

const SimulatorState = (() => {

  // ── Enumeração de estados ─────────────────────────────────
  const STATES = Object.freeze({
    OFF:      'OFF',
    PRESSING: 'PRESSING',
    BOOTING:  'BOOTING',
    WELCOME:  'WELCOME',
  });

  // ── Mapa de transições válidas ────────────────────────────
  // { ESTADO_ATUAL: [estados_permitidos...] }
  const TRANSITIONS = Object.freeze({
    [STATES.OFF]:      [STATES.PRESSING],
    [STATES.PRESSING]: [STATES.OFF, STATES.BOOTING],
    [STATES.BOOTING]:  [STATES.WELCOME],
    [STATES.WELCOME]:  [],   // estado terminal (neste módulo)
  });

  // ── Estado interno ────────────────────────────────────────
  let _currentState = STATES.OFF;
  let _previousState = null;
  const _listeners = new Map(); // { estado: [callbacks...] }
  const _globalListeners = [];  // executados em qualquer transição

  // ── Logger de depuração ───────────────────────────────────
  const _log = (msg) => {
    if (window.__CONSYSENCIA_DEBUG__) {
      console.log(`[FSM] ${msg}`);
    }
  };

  // ── API Pública ───────────────────────────────────────────

  /**
   * Retorna o estado atual (read-only).
   * @returns {string}
   */
  const getState = () => _currentState;

  /**
   * Verifica se o estado atual é o informado.
   * @param {string} state
   * @returns {boolean}
   */
  const is = (state) => _currentState === state;

  /**
   * Tenta realizar uma transição para o novo estado.
   * Lança erro se a transição for inválida — evita estados inconsistentes.
   * @param {string} nextState
   * @returns {boolean} — true se a transição foi realizada
   */
  const transition = (nextState) => {
    const allowed = TRANSITIONS[_currentState];

    // Valida se a transição é permitida
    if (!allowed.includes(nextState)) {
      _log(`Transição BLOQUEADA: ${_currentState} → ${nextState}`);
      return false;
    }

    _log(`Transição: ${_currentState} → ${nextState}`);

    _previousState = _currentState;
    _currentState = nextState;

    // Notifica listeners específicos do novo estado
    const stateListeners = _listeners.get(nextState) || [];
    stateListeners.forEach(cb => cb({
      from: _previousState,
      to:   _currentState,
    }));

    // Notifica listeners globais
    _globalListeners.forEach(cb => cb({
      from: _previousState,
      to:   _currentState,
    }));

    return true;
  };

  /**
   * Registra um callback para quando um estado específico for ativado.
   * @param {string} state
   * @param {Function} callback — recebe { from, to }
   */
  const onEnter = (state, callback) => {
    if (!_listeners.has(state)) {
      _listeners.set(state, []);
    }
    _listeners.get(state).push(callback);
  };

  /**
   * Registra um callback para qualquer transição de estado.
   * @param {Function} callback — recebe { from, to }
   */
  const onChange = (callback) => {
    _globalListeners.push(callback);
  };

  /**
   * Retorna o estado anterior (útil para debugging).
   * @returns {string|null}
   */
  const getPreviousState = () => _previousState;

  /**
   * Expõe o enum de estados para uso externo (leitura apenas).
   */
  const STATES_PUBLIC = STATES;

  // ── Retorna API ───────────────────────────────────────────
  return Object.freeze({
    STATES: STATES_PUBLIC,
    getState,
    is,
    transition,
    onEnter,
    onChange,
    getPreviousState,
  });

})();

// Expõe globalmente para os outros módulos
window.SimulatorState = SimulatorState;
