import {
  createSalaryPayment,
  createWorker,
  createWorkerLeave,
  getWorkerLedger,
  listWorkers,
  removeSalaryPayment,
  removeWorker,
  removeWorkerLeave,
  updateSalaryPayment,
  updateWorker,
  updateWorkerLeave,
} from '../services/workerService.js'
import { ok } from '../utils/apiResponse.js'

export async function listWorkersController(_req, res, next) {
  try {
    return ok(res, await listWorkers())
  } catch (err) {
    return next(err)
  }
}

export async function createWorkerController(req, res, next) {
  try {
    return ok(res, await createWorker(req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateWorkerController(req, res, next) {
  try {
    return ok(res, await updateWorker(req.params.id, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deleteWorkerController(req, res, next) {
  try {
    return ok(res, await removeWorker(req.params.id))
  } catch (err) {
    return next(err)
  }
}

export async function getWorkerLedgerController(req, res, next) {
  try {
    return ok(res, await getWorkerLedger(req.params.id, req.query))
  } catch (err) {
    return next(err)
  }
}

export async function createWorkerLeaveController(req, res, next) {
  try {
    return ok(res, await createWorkerLeave(req.params.id, req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateWorkerLeaveController(req, res, next) {
  try {
    return ok(res, await updateWorkerLeave(req.params.id, req.params.leaveId, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deleteWorkerLeaveController(req, res, next) {
  try {
    return ok(res, await removeWorkerLeave(req.params.id, req.params.leaveId, req.query))
  } catch (err) {
    return next(err)
  }
}

export async function createSalaryPaymentController(req, res, next) {
  try {
    return ok(res, await createSalaryPayment(req.params.id, req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateSalaryPaymentController(req, res, next) {
  try {
    return ok(res, await updateSalaryPayment(req.params.id, req.params.paymentId, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deleteSalaryPaymentController(req, res, next) {
  try {
    return ok(res, await removeSalaryPayment(req.params.id, req.params.paymentId, req.query))
  } catch (err) {
    return next(err)
  }
}
