export function getTzOffset(): number {
	return -new Date().getTimezoneOffset()
}
