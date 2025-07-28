// Вспомогательные функции
function isValidDate(dateString) {
	const regex = /^\d{2}\.\d{2}\.\d{4}$/;
	if (!regex.test(dateString)) return false;
	
	const [day, month, year] = dateString.split('.').map(Number);
	const date = new Date(year, month - 1, day);
	return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
}

function isValidTime(timeString) {
	const regex = /^\d{2}:\d{2}$/;
	if (!regex.test(timeString)) return false;
	
	const [hours, minutes] = timeString.split(':').map(Number);
	return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

module.exports = {
	isValidDate,
	isValidTime
};
