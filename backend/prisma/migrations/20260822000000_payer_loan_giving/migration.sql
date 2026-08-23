-- CreateEnum
CREATE TYPE "PayerLoanBorrowerType" AS ENUM ('SELF', 'OUTSIDE');

-- CreateEnum
CREATE TYPE "PayerLoanStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "loan_borrowers" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_borrowers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payer_loans" (
    "id" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "borrowerType" "PayerLoanBorrowerType" NOT NULL,
    "borrowerId" TEXT,
    "principalAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(12,2) NOT NULL,
    "status" "PayerLoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payer_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payer_loan_payments" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payer_loan_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loan_borrowers_username_key" ON "loan_borrowers"("username");

-- AddForeignKey
ALTER TABLE "payer_loans" ADD CONSTRAINT "payer_loans_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payer_loans" ADD CONSTRAINT "payer_loans_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "loan_borrowers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payer_loan_payments" ADD CONSTRAINT "payer_loan_payments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "payer_loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
