import {
  createGasPayment,
  createGasPurchase,
  createGasSupplier,
  createUtilityBill,
  getGasSupplierLedger,
  listGasSuppliers,
  listUtilityBills,
  removeGasPayment,
  removeGasPurchase,
  removeGasSupplier,
  removeUtilityBill,
  updateGasPayment,
  updateGasPurchase,
  updateGasSupplier,
  updateUtilityBill,
  updateUtilityBillStatus,
  listDueReminders,
} from '../services/gasService.js'
import { ok } from '../utils/apiResponse.js'

export async function listGasSuppliersController(_req, res, next) {
  try {
    return ok(res, await listGasSuppliers())
  } catch (err) {
    return next(err)
  }
}

export async function createGasSupplierController(req, res, next) {
  try {
    return ok(res, await createGasSupplier(req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateGasSupplierController(req, res, next) {
  try {
    return ok(res, await updateGasSupplier(req.params.id, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deleteGasSupplierController(req, res, next) {
  try {
    return ok(res, await removeGasSupplier(req.params.id))
  } catch (err) {
    return next(err)
  }
}

export async function getGasSupplierLedgerController(req, res, next) {
  try {
    return ok(res, await getGasSupplierLedger(req.params.id))
  } catch (err) {
    return next(err)
  }
}

export async function createGasPurchaseController(req, res, next) {
  try {
    return ok(res, await createGasPurchase(req.params.id, req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateGasPurchaseController(req, res, next) {
  try {
    return ok(res, await updateGasPurchase(req.params.id, req.params.purchaseId, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deleteGasPurchaseController(req, res, next) {
  try {
    return ok(res, await removeGasPurchase(req.params.id, req.params.purchaseId))
  } catch (err) {
    return next(err)
  }
}

export async function createGasPaymentController(req, res, next) {
  try {
    return ok(res, await createGasPayment(req.params.id, req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateGasPaymentController(req, res, next) {
  try {
    return ok(res, await updateGasPayment(req.params.id, req.params.paymentId, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deleteGasPaymentController(req, res, next) {
  try {
    return ok(res, await removeGasPayment(req.params.id, req.params.paymentId))
  } catch (err) {
    return next(err)
  }
}

export async function listUtilityBillsController(req, res, next) {
  try {
    return ok(res, await listUtilityBills(req.query))
  } catch (err) {
    return next(err)
  }
}

export async function createUtilityBillController(req, res, next) {
  try {
    return ok(res, await createUtilityBill(req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateUtilityBillController(req, res, next) {
  try {
    return ok(res, await updateUtilityBill(req.params.id, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function updateUtilityBillStatusController(req, res, next) {
  try {
    return ok(res, await updateUtilityBillStatus(req.params.id, req.body, req.user))
  } catch (err) {
    return next(err)
  }
}

export async function deleteUtilityBillController(req, res, next) {
  try {
    return ok(res, await removeUtilityBill(req.params.id, req.query))
  } catch (err) {
    return next(err)
  }
}

export async function listDueRemindersController(req, res, next) {
  try {
    return ok(res, await listDueReminders(req.query))
  } catch (err) {
    return next(err)
  }
}
