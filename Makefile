run:
	cd backend && python3 main.py & \
	cd frontend && npm install && npm run dev -- --open