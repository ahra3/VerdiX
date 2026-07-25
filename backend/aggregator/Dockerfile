
FROM golang:alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o aggregator .

FROM alpine:3.20
WORKDIR /app
COPY --from=builder /app/aggregator .
COPY --from=builder /app/root_cause_taxonomy.json .
EXPOSE 8080
CMD ["./aggregator"]
