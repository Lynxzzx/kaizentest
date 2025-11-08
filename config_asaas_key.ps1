# Script para configurar ASAAS_API_KEY no Vercel
# Execute: .\config_asaas_key.ps1

$ASAAS_KEY = "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmViYjQ5ZDliLWZmN2EtNGI5Yi1iYTk5LWE3ZjkwZmQyM2ZmZDo6JGFhY2hfNDg1ZDI4ZmQtOGEyMC00ZTZiLTg0YzQtNjE1MWM2MGFhZjBk"

Write-Host "Configurando ASAAS_API_KEY no Vercel..." -ForegroundColor Yellow

# Production
Write-Host "`nAdicionando para Production..." -ForegroundColor Cyan
echo $ASAAS_KEY | vercel env add ASAAS_API_KEY production

# Preview
Write-Host "`nAdicionando para Preview..." -ForegroundColor Cyan
echo $ASAAS_KEY | vercel env add ASAAS_API_KEY preview

# Development
Write-Host "`nAdicionando para Development..." -ForegroundColor Cyan
echo $ASAAS_KEY | vercel env add ASAAS_API_KEY development

Write-Host "`n✅ Configuração concluída!" -ForegroundColor Green
Write-Host "⚠️ IMPORTANTE: Faça um REDEPLOY no Vercel para aplicar as mudanças!" -ForegroundColor Yellow
