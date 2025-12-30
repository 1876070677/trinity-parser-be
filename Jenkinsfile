pipeline {
    agent any

    environment {
        DOCKER_COMPOSE_FILE = 'docker-compose.yml'
        PROJECT_NAME = 'trinity-parser'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Environment Setup') {
            steps {
                withCredentials([file(credentialsId: 'trinity-env-file', variable: 'ENV_FILE')]) {
                    sh '''
                        cp "${ENV_FILE}" .env
                        chmod 644 .env
                    '''
                }
            }
        }

        stage('Build Images') {
            steps {
                sh '''
                    docker-compose -f ${DOCKER_COMPOSE_FILE} -p ${PROJECT_NAME} build --no-cache
                '''
            }
        }

        stage('Stop Existing Containers') {
            steps {
                sh '''
                    docker-compose -f ${DOCKER_COMPOSE_FILE} -p ${PROJECT_NAME} down --remove-orphans || true
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    docker-compose -f ${DOCKER_COMPOSE_FILE} -p ${PROJECT_NAME} up -d
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    echo "Waiting for services to be healthy..."
                    sleep 30

                    # Kafka 상태 확인
                    docker exec trinity-kafka kafka-broker-api-versions --bootstrap-server localhost:9092 || exit 1

                    # Redis 상태 확인
                    docker exec redis-trinity redis-cli ping || exit 1

                    # PostgreSQL 상태 확인
                    docker exec postgres-trinity pg_isready || exit 1

                    echo "All services are running!"
                '''
            }
        }
    }

    post {
        success {
            echo 'Deployment successful!'
        }
        failure {
            echo 'Deployment failed!'
            sh '''
                echo "Collecting logs from failed containers..."
                docker-compose -f ${DOCKER_COMPOSE_FILE} -p ${PROJECT_NAME} logs --tail=100
            '''
        }
        always {
            // .env 파일 정리 (보안)
            sh '''
                rm -f .env || true
            '''
        }
        cleanup {
            sh '''
                docker system prune -f || true
            '''
        }
    }
}
