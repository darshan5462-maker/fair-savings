-- AlterTable
ALTER TABLE "loans" ADD COLUMN "borrowerType" "PayerLoanBorrowerType" NOT NULL DEFAULT 'SELF',
ADD COLUMN "borrowerId" TEXT;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "loan_borrowers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
