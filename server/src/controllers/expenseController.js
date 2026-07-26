import {
  createExpense,
  listExpenses,
  removeExpense,
  updateExpense,
} from '../services/expenseService.js'
import { ok } from '../utils/apiResponse.js'

export async function listExpensesController(req, res, next) {
  try {
    return ok(res, await listExpenses(req.query))
  } catch (err) {
    return next(err)
  }
}

export async function createExpenseController(req, res, next) {
  try {
    return ok(res, await createExpense(req.body), 201)
  } catch (err) {
    return next(err)
  }
}

export async function updateExpenseController(req, res, next) {
  try {
    return ok(res, await updateExpense(req.params.id, req.body))
  } catch (err) {
    return next(err)
  }
}

export async function deleteExpenseController(req, res, next) {
  try {
    return ok(res, await removeExpense(req.params.id, req.query))
  } catch (err) {
    return next(err)
  }
}
