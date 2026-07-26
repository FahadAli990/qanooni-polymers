import {
  createSupplier,
  createSupplierPayment,
  getSupplierLedger,
  listSuppliers,
  removeSupplier,
  removeSupplierPayment,
  updateSupplier,
  updateSupplierPayment,
} from '../services/supplierService.js'
import { ok } from '../utils/apiResponse.js'

export async function listSuppliersController(_req, res, next) {
  try {
    return ok(res, await listSuppliers())
  } catch (err) {
    return next(err)
  }
}

export async function createSupplierController(req, res, next) {
  try {
    return ok(res, await createSupplier(req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateSupplierController(req, res, next) {
  try {
    return ok(res, await updateSupplier(req.params.id, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deleteSupplierController(req, res, next) {
  try {
    return ok(res, await removeSupplier(req.params.id))
  } catch (err) {
    return next(err)
  }
}

export async function getSupplierLedgerController(req, res, next) {
  try {
    return ok(res, await getSupplierLedger(req.params.id))
  } catch (err) {
    return next(err)
  }
}

export async function createSupplierPaymentController(req, res, next) {
  try {
    return ok(res, await createSupplierPayment(req.params.id, req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateSupplierPaymentController(req, res, next) {
  try {
    return ok(res, await updateSupplierPayment(req.params.id, req.params.paymentId, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deleteSupplierPaymentController(req, res, next) {
  try {
    return ok(res, await removeSupplierPayment(req.params.id, req.params.paymentId))
  } catch (err) {
    return next(err)
  }
}
