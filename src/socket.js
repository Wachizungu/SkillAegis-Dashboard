import { reactive, computed } from "vue";
import { io } from "socket.io-client";
import debounce from 'lodash.debounce'

// "undefined" means the URL will be computed from the `window.location` object
const URL = process.env.NODE_ENV === "production" ? undefined : "http://localhost:4000";
const MAX_LIVE_LOG = 30

const initial_state = {
  notificationEvents: [],
  notificationCounter: 0,
  notificationAPICounter: 0,
  exercises: [],
  selected_exercises: [],
  progresses: {},
  diagnostic: {},
}

const state = reactive({ ...initial_state });
const connectionState = reactive({ 
  connected: false,
  zmq_last_time: false,
})


const socket = io(URL, {
  autoConnect: true
});


/* Public */
/* ------ */

export const exercises = computed(() => state.exercises)
export const selected_exercises = computed(() => state.selected_exercises)
export const active_exercises = computed(() => state.exercises.filter((exercise) => state.selected_exercises.includes(exercise.uuid)))
export const progresses = computed(() => state.progresses)
export const notifications = computed(() => state.notificationEvents)
export const notificationCounter = computed(() => state.notificationCounter)
export const notificationAPICounter = computed(() => state.notificationAPICounter)
export const userCount = computed(() => Object.keys(state.progresses).length)
export const diagnostic = computed(() => state.diagnostic)
export const socketConnected = computed(() => connectionState.connected)
export const zmqLastTime = computed(() => connectionState.zmq_last_time)

export function resetState() {
  Object.assign(state, initial_state);
}

export function fullReload() {
  getExercises()
  getSelectedExercises()
  getNotifications()
  getProgress()
}

export function setCompletedState(completed, user_id, exec_uuid, task_uuid) {
  const payload = {
    user_id: user_id,
    exercise_uuid: exec_uuid,
    task_uuid: task_uuid,
  }
  sendCompletedState(completed, payload)
}

export function resetAllExerciseProgress() {
  sendResetAllExerciseProgress()
}

export function resetLiveLogs() {
  sendResetLiveLogs()
}

export function changeExerciseSelection(exec_uuid, state_enabled) {
  const payload = {
    exercise_uuid: exec_uuid,
    selected: state_enabled,
  }
  sendChangeExerciseSelection(payload)
}

export function toggleVerboseMode(enabled) {
  sendToggleVerboseMode(enabled)
}

export function toggleApiQueryMode(enabled) {
  sendToggleApiQueryMode(enabled)
}

export const debouncedGetProgress = debounce(getProgress, 200, {leading: true})
export const debouncedGetDiangostic = debounce(getDiangostic, 1000, {leading: true})


/* Private */
/* ------- */

function getExercises() {
  socket.emit("get_exercises", (all_exercises) => {
    state.exercises = all_exercises
  })
}

function getSelectedExercises() {
  socket.emit("get_selected_exercises", (all_selected_exercises) => {
    state.selected_exercises = all_selected_exercises
  })
}

function getNotifications() {
  socket.emit("get_notifications", (all_notifications) => {
    state.notificationEvents = all_notifications
  })
}

function getProgress() {
  socket.emit("get_progress", (all_progress) => {
    state.progresses = all_progress
  })
}

function getDiangostic() {
  state.diagnostic = {}
  socket.emit("get_diagnostic", (diagnostic) => {
    state.diagnostic = diagnostic
  })
}

function sendCompletedState(completed, payload) {
  const event_name = !completed ? "mark_task_completed": "mark_task_incomplete"
  socket.emit(event_name, payload, () => {
    getProgress()
  })
}

function sendResetAllExerciseProgress() {
  socket.emit("reset_all_exercise_progress", () => {
    getProgress()
  })
}

function sendResetLiveLogs() {
  socket.emit("reset_notifications", () => {
    getNotifications()
  })
}

function sendChangeExerciseSelection(payload) {
  socket.emit("change_exercise_selection", payload, () => {
    getSelectedExercises()
  })
}

function sendToggleVerboseMode(enabled) {
  const payload = {
    verbose: enabled
  }
  socket.emit("toggle_verbose_mode", payload, () => {})
}

function sendToggleApiQueryMode(enabled) {
  const payload = {
    apiquery: enabled
  }
  socket.emit("toggle_apiquery_mode", payload, () => {})
}

/* Event listener */

socket.on("connect", () => {
  connectionState.connected = true;
});

socket.on("disconnect", () => {
  connectionState.connected = false;
});

socket.on("notification", (message) => {
  state.notificationCounter += 1
  if (message.is_api_request) {
    state.notificationAPICounter += 1
  }
  addLimited(state.notificationEvents, message, MAX_LIVE_LOG)
});

socket.on("new_user", (new_user) => {
  debouncedGetProgress()
});

socket.on("refresh_score", (new_user) => {
  debouncedGetProgress()
});

socket.on("keep_alive", (keep_alive) => {
  connectionState.zmq_last_time = keep_alive['zmq_last_time']
});

function addLimited(target, message, maxCount) {
  target.unshift(message)
  if (target.length > maxCount) {
    target.length = maxCount
  }
}